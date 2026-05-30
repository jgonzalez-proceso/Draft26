// Verifica RPCs de admin: update_league_settings, update_draft_config y ciclo de vida.
import { createClient } from "@supabase/supabase-js";
import { Client as PgClient } from "pg";

const URL = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_ANON_KEY;
const rnd = Math.random().toString(36).slice(2, 8);
const mk = () => createClient(URL, KEY, { auth: { persistSession: false } });
const log = (...a) => console.log(...a);
const die = (m) => { console.error("✗", m); process.exit(1); };
const ok = (c, m) => log(c ? `  ✓ ${m}` : `  ✗ ${m}`) || (!c && die(m));

const su = async (c, e) => {
  const { data, error } = await c.auth.signUp({ email: e, password: "Test1234!", options: { data: { display_name: e.split("@")[0] } } });
  if (error) die(`signUp: ${error.message}`);
  if (!data.session) die("sin sesión (¿Confirm email sigue ON?)");
};

const run = async () => {
  const a = mk(), b = mk();
  const eA = `adm.a.${rnd}@gmail.com`, eB = `adm.b.${rnd}@gmail.com`;
  await su(a, eA); await su(b, eB);

  const { data: lg } = await a.rpc("create_league", {
    p_name: `AdminTest ${rnd}`, p_max_participants: 8, p_world_cup_year: 2026,
    p_draft_mode: "snake", p_timer_enabled: true, p_turn_seconds: 90, p_picks_per_user: null });
  await b.rpc("join_league", { p_invite_code: lg.invite_code });

  // update_league_settings
  const { error: eS } = await a.rpc("update_league_settings", { p_league_id: lg.id, p_name: `Renombrada ${rnd}`, p_max_participants: 10 });
  ok(!eS, "update_league_settings");
  const { data: lg2 } = await a.from("leagues").select("name, max_participants").eq("id", lg.id).single();
  ok(lg2.name.startsWith("Renombrada") && lg2.max_participants === 10, "liga renombrada y max=10");

  // update_draft_config
  const { error: eC } = await a.rpc("update_draft_config", { p_league_id: lg.id, p_draft_mode: "linear", p_timer_enabled: false, p_turn_seconds: 120, p_picks_per_user: 3 });
  ok(!eC, "update_draft_config");
  const { data: d1 } = await a.from("drafts").select("*").eq("league_id", lg.id).single();
  ok(d1.draft_mode === "linear" && d1.timer_enabled === false && d1.picks_per_user === 3, "config aplicada (linear, timer off, picks 3)");

  // un no-admin no puede configurar
  const { error: eForbidden } = await b.rpc("update_draft_config", { p_league_id: lg.id, p_draft_mode: "snake", p_timer_enabled: true, p_turn_seconds: 60, p_picks_per_user: 2 });
  ok(!!eForbidden, "no-admin rechazado en update_draft_config");

  // ciclo de vida
  await a.rpc("draw_draft_order", { p_league_id: lg.id });
  await a.rpc("start_draft", { p_league_id: lg.id });
  let { data: d2 } = await a.from("drafts").select("status,total_picks").eq("league_id", lg.id).single();
  ok(d2.status === "draft_active" && d2.total_picks === 6, "iniciado (total_picks=3×2=6)");

  // config bloqueada con draft activo
  const { error: eLocked } = await a.rpc("update_draft_config", { p_league_id: lg.id, p_draft_mode: "snake", p_timer_enabled: true, p_turn_seconds: 60, p_picks_per_user: 2 });
  ok(!!eLocked, "config bloqueada con draft activo");

  await a.rpc("pause_draft", { p_league_id: lg.id });
  ({ data: d2 } = await a.from("drafts").select("status").eq("league_id", lg.id).single());
  ok(d2.status === "draft_paused", "pausado");

  await a.rpc("resume_draft", { p_league_id: lg.id });
  ({ data: d2 } = await a.from("drafts").select("status").eq("league_id", lg.id).single());
  ok(d2.status === "draft_active", "reanudado");

  await a.rpc("reset_draft", { p_league_id: lg.id });
  ({ data: d2 } = await a.from("drafts").select("status,current_pick_number").eq("league_id", lg.id).single());
  ok(d2.status === "pending_draw" && d2.current_pick_number === 0, "reiniciado (pending_draw, pick 0)");

  await a.rpc("start_draft", { p_league_id: lg.id });
  await a.rpc("finish_draft", { p_league_id: lg.id });
  ({ data: d2 } = await a.from("drafts").select("status").eq("league_id", lg.id).single());
  ok(d2.status === "draft_finished", "finalizado");

  // limpieza
  if (process.env.DATABASE_URL) {
    const pg = new PgClient({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await pg.connect();
    await pg.query("delete from public.leagues where id=$1", [lg.id]);
    await pg.query("delete from auth.users where email in ($1,$2)", [eA, eB]);
    await pg.end();
    log("  ✓ limpieza");
  }
  log("\n✔ RPCs de admin verificadas.");
};
run().catch((e) => die(e.message));
