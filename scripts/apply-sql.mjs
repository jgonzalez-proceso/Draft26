// Aplica archivos SQL contra la base de datos de Supabase usando la connection string.
// Uso:  DATABASE_URL="postgresql://..." node scripts/apply-sql.mjs <archivo.sql> [<archivo2.sql> ...]
// La URL se pasa por entorno para no dejarla en el repo.

import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL en el entorno.");
  process.exit(1);
}
const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("Indica al menos un archivo .sql");
  process.exit(1);
}

const client = new Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false }, // Supabase usa TLS; no verificamos CA del pooler
});

const run = async () => {
  await client.connect();
  for (const f of files) {
    const abs = path.resolve(process.cwd(), f);
    const sql = fs.readFileSync(abs, "utf8");
    process.stdout.write(`→ Ejecutando ${f} … `);
    try {
      await client.query(sql);
      console.log("OK");
    } catch (err) {
      console.log("ERROR");
      console.error(`\n[${f}] ${err.message}\n`);
      throw err;
    }
  }
  await client.end();
  console.log("\n✔ Todo aplicado correctamente.");
};

run().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
