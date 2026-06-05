// Cruza championshipplayers22.txt (rol por jugador) contra nuestro CSV
// (= jugadores/posiciones de la BD) y reporta las posiciones a corregir.
//
//   node scripts/fix-positions.mjs            -> resumen + lista de cambios
//   node scripts/fix-positions.mjs --sql      -> además escribe supabase/fix_positions.sql
//
// Empareja por nombre normalizado (sin acentos/may.). El archivo usa a menudo
// solo el apellido, así que el match es: igualdad completa normalizada, o el
// nombre del archivo == sufijo del nuestro y ÚNICO entre los del archivo.
import fs from "node:fs";

const FILE = "C:/Users/javie/Downloads/championshipplayers22.txt";
// CSV de entrada (nuestra BD). Se puede sobreescribir con CSV_IN para generar el
// SQL contra una versión pristina (p. ej. la de git) sin tocar el archivo de trabajo.
const CSV = process.env.CSV_IN || "supabase/data/convocados_mundial_2026.csv";

const ROLE_TO_POS = {
  portero: "GK",
  defensa: "DEF",
  centrocampista: "MID",
  delantero: "FWD",
};
// Nuestro CSV usa estas etiquetas ES en la columna "posicion".
const CSV_POS_TO_CODE = {
  portero: "GK",
  defensa: "DEF",
  medio: "MID",
  centrocampista: "MID",
  delantero: "FWD",
};

// Corrige mojibake típico (UTF-8 leído como Latin-1): "GimÃ©nez" -> "Giménez".
function fixMojibake(s) {
  if (!/[ÃÂ]/.test(s)) return s;
  try {
    const f = Buffer.from(s, "latin1").toString("utf8");
    // Solo aceptar si no introdujo el carácter de reemplazo.
    return f.includes("�") ? s : f;
  } catch {
    return s;
  }
}

function norm(s) {
  return fixMojibake(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita acentos
    .replace(/[''`.]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// ---- 1) Archivo: nombre -> posición ----
const j = JSON.parse(fs.readFileSync(FILE, "utf8"));
const filePlayers = j.answer.players;

const byFull = new Map(); // norm completo -> Set(pos)
const byLast = new Map(); // último token -> Set(pos), y conteo de nombres distintos
const lastNames = new Map(); // último token -> Set(norm completos) para detectar ambigüedad

for (const p of filePlayers) {
  const pos = ROLE_TO_POS[p.role];
  if (!pos) continue;
  const n = norm(p.name);
  if (!n) continue;
  if (!byFull.has(n)) byFull.set(n, new Set());
  byFull.get(n).add(pos);
  const toks = n.split(" ");
  const last = toks[toks.length - 1];
  if (!byLast.has(last)) byLast.set(last, new Set());
  byLast.get(last).add(pos);
  if (!lastNames.has(last)) lastNames.set(last, new Set());
  lastNames.get(last).add(n);
}

// ---- 2) CSV (nuestra BD) ----
const lines = fs.readFileSync(CSV, "utf8").split(/\r?\n/).filter(Boolean);
const header = lines[0].split(",");
const iPos = header.indexOf("posicion");
const iName = header.indexOf("jugador");
const iSel = header.indexOf("seleccion");

// Parser CSV simple con comillas.
function parseLine(line) {
  const out = [];
  let cur = "", q = false;
  for (let k = 0; k < line.length; k++) {
    const c = line[k];
    if (q) {
      if (c === '"' && line[k + 1] === '"') { cur += '"'; k++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

const rows = lines.slice(1).map(parseLine);

// Correcciones verificadas a mano: jugadores cuyo apellido es ambiguo en el archivo
// pero cuya entrada correcta se ha confirmado individualmente (por club/rol).
const MANUAL = {
  // Senegal
  "Iliman Ndiaye": "MID", // archivo "I. Ndiaye": centrocampista
  // Argentina
  "Nicolas Gonzalez": "MID", // archivo "Nico González": centrocampista
  "Nicolas Paz":      "MID", // archivo "Nico Paz": centrocampista
  // Colombia
  "Juan Fernando Quintero": "FWD", // archivo "Quintero": delantero
  // Costa de Marfil
  "Bazoumana Touré": "MID",  // archivo "B. Toure": centrocampista
  // Panamá
  "José Luis Rodríguez": "MID", // confirmado: centrocampista
  // Corea del Sur — el archivo usa solo el nombre de pila
  "Jin-seob Park":  "MID", // archivo "Jin-seob": centrocampista
  "Yu-min Cho":     "MID", // archivo "Cho Yu-Min": centrocampista
  "Hyun-jun Yang":  "FWD", // archivo "Hyun-Jun": delantero
  "Ji-sung Eom":    "FWD", // archivo "Ji-sung": delantero
};

const changes = [];
const matchedFull = [];
const matchedLast = [];
const unmatched = [];
const ambiguous = [];

for (const r of rows) {
  const name = r[iName];
  const sel = r[iSel];
  const ourPos = CSV_POS_TO_CODE[norm(r[iPos])];
  if (!name || !ourPos) continue;
  const n = norm(name);

  let filePos = null;
  let how = null;

  if (MANUAL[name]) {
    filePos = MANUAL[name];
    how = "manual";
    matchedFull.push(name);
  } else if (byFull.has(n)) {
    const set = byFull.get(n);
    filePos = [...set][0];
    how = "full";
    if (set.size > 1) { ambiguous.push({ name, sel, reason: "rol múltiple en archivo", set: [...set] }); continue; }
    matchedFull.push(name);
  } else {
    const toks = n.split(" ");
    const last = toks[toks.length - 1];
    // Match por apellido SOLO si todas las entradas del archivo con ese apellido
    // coinciden en una única posición (byLast). Así, aunque haya varios jugadores
    // que comparten apellido, el cambio es seguro si todos juegan en la misma
    // demarcación; si discrepan, es ambiguo y no se toca. Además exigimos que el
    // apellido tenga ≥4 letras para evitar fragmentos romanizados cortos.
    if (last.length >= 4 && byLast.has(last) && byLast.get(last).size === 1) {
      filePos = [...byLast.get(last)][0];
      how = lastNames.get(last).size === 1 ? "last" : "last(varios, misma pos)";
      matchedLast.push(name);
    } else if (byLast.has(last)) {
      ambiguous.push({ name, sel, reason: `apellido "${last}" con posiciones discrepantes/corto` });
      continue;
    } else {
      unmatched.push({ name, sel });
      continue;
    }
  }

  if (filePos && filePos !== ourPos) {
    changes.push({ name, sel, from: ourPos, to: filePos, how });
  }
}

// ---- 3) Reporte ----
console.log("=== COBERTURA ===");
console.log("Jugadores en archivo:", filePlayers.length);
console.log("Jugadores en nuestra BD (CSV):", rows.length);
console.log("Emparejados por nombre completo:", matchedFull.length);
console.log("Emparejados por apellido único:", matchedLast.length);
console.log("Ambiguos (no tocados):", ambiguous.length);
console.log("Sin emparejar (no tocados):", unmatched.length);
console.log("");
console.log("=== CAMBIOS DE POSICIÓN PROPUESTOS:", changes.length, "===");
const byTransition = {};
for (const c of changes) {
  const k = `${c.from} -> ${c.to}`;
  byTransition[k] = (byTransition[k] || 0) + 1;
}
console.log("Por transición:", byTransition);
console.log("");
for (const c of changes.sort((a, b) => a.sel.localeCompare(b.sel) || a.name.localeCompare(b.name))) {
  console.log(`  [${c.sel}] ${c.name}: ${c.from} -> ${c.to}  (${c.how})`);
}

if (process.argv.includes("--dump-ambig")) {
  console.log("\n=== AMBIGUOS ===");
  for (const a of ambiguous) console.log(`  [${a.sel}] ${a.name} — ${a.reason}`);
  console.log("\n=== SIN EMPAREJAR ===");
  for (const u of unmatched) console.log(`  [${u.sel}] ${u.name}`);
}

if (process.argv.includes("--apply-csv")) {
  // Reescribe la columna "posicion" del CSV para los jugadores corregidos, para
  // que el catálogo fuente quede alineado y un futuro `npm run seed` no revierta.
  const CODE_TO_CSV = { GK: "Portero", DEF: "Defensa", MID: "Medio", FWD: "Delantero" };
  const want = new Map(changes.map((c) => [c.name, CODE_TO_CSV[c.to]]));
  let applied = 0;
  const out = lines.map((line, idx) => {
    if (idx === 0) return line;
    const cols = parseLine(line);
    const tgt = want.get(cols[iName]);
    if (tgt && cols[iPos] !== tgt) {
      cols[iPos] = tgt;
      applied++;
      return cols
        .map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c))
        .join(",");
    }
    return line;
  });
  fs.writeFileSync(CSV, out.join("\n") + "\n");
  console.log(`\nCSV actualizado: ${applied} filas reescritas.`);
}

if (process.argv.includes("--sql")) {
  const esc = (s) => s.replace(/'/g, "''");
  const sql = [
    "-- Corrección de posiciones para que coincidan con championshipplayers22.txt",
    "-- Generado por scripts/fix-positions.mjs. Empareja por nombre.",
    "begin;",
    ...changes.map(
      (c) =>
        `update players set primary_position='${c.to}' where full_name='${esc(
          c.name,
        )}' and primary_position='${c.from}';`,
    ),
    "commit;",
  ].join("\n");
  fs.writeFileSync("supabase/fix_positions.sql", sql + "\n");
  console.log("\nSQL escrito en supabase/fix_positions.sql");
}
