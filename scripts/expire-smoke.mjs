// Verifica el auto-skip por tiempo (expire_turn).
import { createClient } from "@supabase/supabase-js";
import { Client as PgClient } from "pg";

const URL = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_ANON_KEY;
const rnd = Math.random().toString(36).slice(2, 8);
const mk = () => createClient(URL, KEY, { auth: { persistSession: false } });
const log = (...a) => console.log(...a);
const die = (m) => { console.error("✗", m); process.exit(1); };
const ok = (c, m) => { log(c ? `  ✓ ${m}` : `  ✗ ${m}`); if (!c) die(m); };
const su = async (c, e) => { const { data, error } = await c.auth.signUp({ email: e, password: "Test1234!", options: { data: { display_name: e.split("@")[0] } } }); if (error || !data.session) die(`signUp ${e}`); };

const run = async () => {
  const a = mk(), b = mk();
  const eA = `exp.a.${rnd}@gmail.com`, eB = `exp.b.${rnd}@gmail.com`;
  await su(a, eA); await su(b, eB);

  const { data: lg } = await a.rpc("create_league", { p_name: `Exp ${rnd}`, p_max_participants: 4, p_world_cup_year: 2026, p_draft_mode: "snake", p_timer_enabled: true, p_turn_seconds: 15, p_picks_per_user: 2 });
  await b.rpc("join_league", { p_invite_code: lg.invite_code });
  await a.rpc("draw_draft_order", { p_league_id: lg.id });
  await a.rpc("start_draft", { p_league_id: lg.id });

  const { data: d0 } = await a.from("drafts").select("id,current_pick_number,current_turn_user_id").eq("league_id", lg.id).single();
  log(`  draft activo, pick #${d0.current_pick_number}`);

  // Forzar deadline en el pasado (simula tiempo agotado) vía conexión directa
  const pg = new PgClient({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await pg.connect();
  await pg.query("update public.drafts set pick_deadline = now() - interval '1 second' where id = $1", [d0.id]);

  // expire_turn (cualquiera puede llamarlo; idempotente)
  const { data: fired, error: eE } = await a.rpc("expire_turn", { p_draft_id: d0.id });
  ok(!eE && fired === true, "expire_turn devolvió true (turno saltado)");

  const { data: d1 } = await a.from("drafts").select("current_pick_number,current_turn_user_id").eq("league_id", lg.id).single();
  ok(d1.current_pick_number === d0.current_pick_number + 1, "el pick avanzó (+1)");
  ok(d1.current_turn_user_id !== d0.current_turn_user_id, "cambió el usuario del turno");

  const { data: skip } = await a.from("draft_picks").select("is_autoskip,player_id").eq("league_id", lg.id).eq("pick_number", d0.current_pick_number).single();
  ok(skip.is_autoskip === true && skip.player_id === null, "registro de turno saltado (autoskip, sin jugador)");

  // Segunda llamada: ya no debe expirar (idempotente)
  const { data: fired2 } = await a.rpc("expire_turn", { p_draft_id: d0.id });
  ok(fired2 === false, "segunda llamada idempotente (false)");

  await pg.query("delete from public.leagues where id=$1", [lg.id]);
  await pg.query("delete from auth.users where email in ($1,$2)", [eA, eB]);
  await pg.end();
  log("  ✓ limpieza\n\n✔ Auto-skip por tiempo verificado.");
};
run().catch((e) => die(e.message));
