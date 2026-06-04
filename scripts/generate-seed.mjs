// Genera supabase/seed.sql a partir del CSV de convocados confirmados.
// Uso: node scripts/generate-seed.mjs <ruta-csv>
// Por defecto busca el CSV de convocados en la carpeta del proyecto (supabase/data).

import fs from "node:fs";
import path from "node:path";

const DEFAULT_CSV = path.resolve(
  process.cwd(),
  "supabase/data/convocados_mundial_2026.csv"
);
const csvPath = process.argv[2] || DEFAULT_CSV;
const outPath = path.resolve(process.cwd(), "supabase/seed.sql");

// Posición ES -> enum
const POS = { Portero: "GK", Defensa: "DEF", Medio: "MID", Delantero: "FWD" };

// Selección -> código ISO para flagcdn
const FLAG = {
  Alemania: "de", Argentina: "ar", Austria: "at", "Bosnia y Herzegovina": "ba",
  Brasil: "br", "Bélgica": "be", "Cabo Verde": "cv", Colombia: "co",
  "Corea del Sur": "kr", "Costa de Marfil": "ci", Croacia: "hr", Curazao: "cw",
  Egipto: "eg", Escocia: "gb-sct", "España": "es", "Estados Unidos": "us",
  Francia: "fr", "Haití": "ht", Inglaterra: "gb-eng", "Japón": "jp",
  Marruecos: "ma", Noruega: "no", "Nueva Zelanda": "nz", "Panamá": "pa",
  "Países Bajos": "nl", Portugal: "pt", "República Democrática del Congo": "cd",
  Senegal: "sn", "Sudáfrica": "za", Suecia: "se", Suiza: "ch", "Túnez": "tn",
  // Selecciones añadidas para el cuadro completo de 48
  "Arabia Saudí": "sa", Argelia: "dz", Australia: "au", "Canadá": "ca",
  Catar: "qa", Ecuador: "ec", Ghana: "gh", Irak: "iq", "Irán": "ir",
  Jordania: "jo", "México": "mx", Paraguay: "py", Chequia: "cz",
  "Turquía": "tr", Uruguay: "uy", "Uzbekistán": "uz",
};

function parseCsv(text) {
  const rows = [];
  let field = "", row = [], inQ = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQ) {
      if (c === '"') { if (src[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c === "\r") { /* skip */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";

const raw = fs.readFileSync(csvPath, "utf8");
const rows = parseCsv(raw);
const headers = rows[0].map((h) => h.trim());
const idx = (name) => headers.indexOf(name);
const iGrupo = idx("grupo"), iSel = idx("seleccion"),
  iPos = idx("posicion"), iJug = idx("jugador"), iClub = idx("club");

const teams = new Map(); // name -> group
const players = [];
for (const r of rows.slice(1)) {
  if (!r[iJug] || !r[iJug].trim()) continue;
  const team = r[iSel].trim();
  const grupo = (r[iGrupo] || "").trim();
  const pos = POS[(r[iPos] || "").trim()];
  if (!pos) continue;
  if (!teams.has(team)) teams.set(team, grupo);
  players.push({
    name: r[iJug].trim(),
    team,
    pos,
    club: (r[iClub] || "").trim(),
  });
}

let sql = `-- =====================================================================
-- Draft Mundial 26 — Seed de plantillas CONFIRMADAS (generado)
-- Generado por scripts/generate-seed.mjs a partir del CSV de convocados.
-- ${teams.size} selecciones · ${players.length} jugadores.
-- Idempotente (ON CONFLICT / NOT EXISTS).
-- =====================================================================

insert into public.national_teams (name, "group", flag_url) values
`;
const teamVals = [...teams.entries()].map(([name, grupo]) => {
  const code = FLAG[name];
  const flag = code ? `https://flagcdn.com/w320/${code}.png` : null;
  return `  (${q(name)}, ${grupo ? q(grupo) : "null"}, ${flag ? q(flag) : "null"})`;
});
sql += teamVals.join(",\n") +
  `\non conflict (name) do update set "group" = excluded."group", flag_url = excluded.flag_url;\n\n`;

sql += `insert into public.players (full_name, national_team_id, primary_position, club)
select v.full_name, t.id, v.pos::position_enum, nullif(v.club, '')
from (values\n`;
const playerVals = players.map(
  (p) => `  (${q(p.name)}, ${q(p.team)}, ${q(p.pos)}, ${q(p.club)})`
);
sql += playerVals.join(",\n");
sql += `\n) as v(full_name, team, pos, club)
join public.national_teams t on t.name = v.team
where not exists (
  select 1 from public.players p
  where p.full_name = v.full_name and p.national_team_id = t.id
);\n`;

fs.writeFileSync(outPath, sql, "utf8");
console.log(`OK → ${outPath}\n  ${teams.size} selecciones, ${players.length} jugadores`);
