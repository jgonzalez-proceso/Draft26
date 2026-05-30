// Prueba E2E del flujo de ligas/draft contra Supabase (usa anon key + 2 usuarios).
// Uso: SUPABASE_URL=... SUPABASE_ANON_KEY=... DATABASE_URL=... node scripts/smoke-test.mjs
import { createClient } from "@supabase/supabase-js";
import { Client as PgClient } from "pg";

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_ANON_KEY;
const rnd = Math.random().toString(36).slice(2, 8);
const mk = () => createClient(URL, KEY, { auth: { persistSession: false } });

const log = (...a) => console.log(...a);
const die = (m) => { console.error("✗", m); process.exit(1); };

async function signUp(client, email) {
  const { data, error } = await client.auth.signUp({
    email, password: "Test1234!", options: { data: { display_name: email.split("@")[0] } },
  });
  if (error) die(`signUp ${email}: ${error.message}`);
  return data.session;
}

const run = async () => {
  const a = mk(), b = mk();
  const emailA = `smoke.a.${rnd}@gmail.com`, emailB = `smoke.b.${rnd}@gmail.com`;

  log("→ Registrando usuario A…");
  const sessA = await signUp(a, emailA);
  if (!sessA) {
    log("\n⚠ El registro no devolvió sesión → 'Confirm email' está ACTIVADO en Supabase.");
    log("  Para poder probar (y para que tú te registres sin email), desactívalo en:");
    log("  Authentication → Sign In / Providers → Email → Confirm email = OFF.");
    process.exit(2);
  }
  log("→ Registrando usuario B…");
  await signUp(b, emailB);

  log("→ A crea liga…");
  const { data: league, error: e1 } = await a.rpc("create_league", {
    p_name: `Smoke ${rnd}`, p_max_participants: 8, p_world_cup_year: 2026,
    p_draft_mode: "snake", p_timer_enabled: true, p_turn_seconds: 60, p_picks_per_user: 2,
  });
  if (e1) die(`create_league: ${e1.message}`);
  log(`  liga ${league.id} código ${league.invite_code}`);

  log("→ B se une con el código…");
  const { error: e2 } = await b.rpc("join_league", { p_invite_code: league.invite_code });
  if (e2) die(`join_league: ${e2.message}`);

  log("→ A sortea el orden…");
  const { error: e3 } = await a.rpc("draw_draft_order", { p_league_id: league.id });
  if (e3) die(`draw_draft_order: ${e3.message}`);

  log("→ A inicia el draft…");
  const { error: e4 } = await a.rpc("start_draft", { p_league_id: league.id });
  if (e4) die(`start_draft: ${e4.message}`);

  const { data: draft } = await a.from("drafts").select("*").eq("league_id", league.id).single();
  log(`  pick #${draft.current_pick_number}, turno de ${draft.current_turn_user_id}, total_picks=${draft.total_picks}`);
  if (draft.status !== "draft_active") die("el draft no quedó activo");

  // Quién tiene el turno
  const { data: { user: ua } } = await a.auth.getUser();
  const turnClient = draft.current_turn_user_id === ua.id ? a : b;
  const who = draft.current_turn_user_id === ua.id ? "A" : "B";
  log(`→ Hace pick el usuario ${who}…`);

  const { data: players } = await turnClient.from("players").select("id, full_name").eq("is_available", true).limit(1);
  if (!players?.length) die("no hay jugadores disponibles");
  const { error: e5 } = await turnClient.rpc("make_pick", { p_draft_id: draft.id, p_player_id: players[0].id });
  if (e5) die(`make_pick: ${e5.message}`);
  log(`  ${who} eligió a ${players[0].full_name}`);

  // Intento ilegal: el mismo usuario intenta volver a elegir (ya no es su turno)
  const { data: p2 } = await turnClient.from("players").select("id").eq("is_available", true).limit(1).single();
  const { error: eIllegal } = await turnClient.rpc("make_pick", { p_draft_id: draft.id, p_player_id: p2.id });
  log(`  pick fuera de turno rechazado: ${eIllegal ? "SÍ ✓ (" + eIllegal.message + ")" : "NO ✗"}`);

  const { data: picks } = await a.from("draft_picks").select("pick_number").eq("league_id", league.id);
  const { data: teams } = await a.from("user_teams").select("id").eq("league_id", league.id);
  const { data: draft2 } = await a.from("drafts").select("current_pick_number").eq("id", draft.id).single();
  log(`  picks=${picks.length} equipos=${teams.length} pick_actual=${draft2.current_pick_number}`);

  // Limpieza: borra la liga (cascada) vía conexión directa
  if (process.env.DATABASE_URL) {
    const pg = new PgClient({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await pg.connect();
    await pg.query("delete from public.leagues where id = $1", [league.id]);
    await pg.query("delete from auth.users where email in ($1,$2)", [emailA, emailB]);
    await pg.end();
    log("→ Limpieza OK (liga y usuarios de prueba borrados)");
  }

  log("\n✔ Flujo E2E correcto.");
};
run().catch((e) => die(e.message));
