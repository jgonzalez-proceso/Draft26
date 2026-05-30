// Verifica el estado de la base de datos tras aplicar migraciones + seed.
import { Client } from "pg";

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const q = (sql) => client.query(sql).then((r) => r.rows);

const run = async () => {
  await client.connect();

  const tables = await q(`
    select table_name from information_schema.tables
    where table_schema='public' order by table_name`);
  console.log("Tablas:", tables.map((t) => t.table_name).join(", "));

  const fns = await q(`
    select routine_name from information_schema.routines
    where routine_schema='public' order by routine_name`);
  console.log("\nFunciones:", fns.map((f) => f.routine_name).join(", "));

  const teams = (await q(`select count(*)::int n from national_teams`))[0].n;
  const players = (await q(`select count(*)::int n from players`))[0].n;
  console.log(`\nSelecciones: ${teams}  ·  Jugadores: ${players}`);

  const byPos = await q(`
    select primary_position::text pos, count(*)::int n
    from players group by primary_position order by primary_position`);
  console.log("Por posición:", byPos.map((r) => `${r.pos}=${r.n}`).join(" "));

  const rls = await q(`
    select tablename, rowsecurity from pg_tables
    where schemaname='public' order by tablename`);
  console.log("\nRLS activo:", rls.filter((r) => r.rowsecurity).map((r) => r.tablename).join(", "));

  const pub = await q(`
    select tablename from pg_publication_tables where pubname='supabase_realtime' order by tablename`);
  console.log("Realtime:", pub.map((r) => r.tablename).join(", ") || "(ninguna)");

  const cron = await q(`select jobname, schedule from cron.job`).catch(() => []);
  console.log("Cron jobs:", cron.map((c) => `${c.jobname} [${c.schedule}]`).join(", ") || "(ninguno)");

  await client.end();
};
run().catch((e) => { console.error(e.message); process.exit(1); });
