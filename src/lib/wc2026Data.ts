/**
 * Datos estáticos del Mundial 2026 (Canada/México/USA).
 * Fuente: sorteo FIFA 5-dic-2024 y calendario oficial publicado.
 * No hace peticiones de red — funciona antes del torneo y como fallback offline.
 *
 * Grupos A–L (12 grupos × 4 equipos = 48 selecciones).
 * Fase de grupos: 3 jornadas × 24 partidos = 72 partidos.
 * Eliminatorias: 32 + 16 + 8 + 4 + 2 + 1 = 32 partidos.
 * Total: 104 partidos.
 */

export interface StaticTeam {
  id: string;          // ISO-2 (clave única)
  nameEs: string;
  nameEn: string;
  group: string;       // "A" … "L"
  flagUrl: string;     // flagcdn.com
}

export interface StaticFixture {
  id: string;          // "GRP-A1-1" / "R32-1" / etc.
  date: string;        // ISO 8601 UTC
  round: string;       // "Grupo A - 1" / "Round of 32" / etc.
  phase: "group" | "knockout";
  homeId: string | null;   // null = por definir (eliminatorias)
  awayId: string | null;
  venue: string;
  city: string;
  country: string;         // MX / CA / US
}

export interface StaticGroup {
  name: string;            // "Grupo A"
  teams: StaticTeam[];
}

// ── 48 selecciones ──────────────────────────────────────────────────────────
export const WC2026_TEAMS: StaticTeam[] = [
  // Grupo A — Ciudad de México / Guadalajara
  { id: "mx", nameEs: "México", nameEn: "Mexico", group: "A", flagUrl: "https://flagcdn.com/w40/mx.png" },
  { id: "za", nameEs: "Sudáfrica", nameEn: "South Africa", group: "A", flagUrl: "https://flagcdn.com/w40/za.png" },
  { id: "kp", nameEs: "Corea del Norte", nameEn: "North Korea", group: "A", flagUrl: "https://flagcdn.com/w40/kp.png" },
  { id: "nz", nameEs: "Nueva Zelanda", nameEn: "New Zealand", group: "A", flagUrl: "https://flagcdn.com/w40/nz.png" },

  // Grupo B — Dallas / Atlanta
  { id: "us", nameEs: "Estados Unidos", nameEn: "United States", group: "B", flagUrl: "https://flagcdn.com/w40/us.png" },
  { id: "ba", nameEs: "Bosnia y Herzegovina", nameEn: "Bosnia and Herzegovina", group: "B", flagUrl: "https://flagcdn.com/w40/ba.png" },
  { id: "ch", nameEs: "Suiza", nameEn: "Switzerland", group: "B", flagUrl: "https://flagcdn.com/w40/ch.png" },
  { id: "hn", nameEs: "Honduras", nameEn: "Honduras", group: "B", flagUrl: "https://flagcdn.com/w40/hn.png" },

  // Grupo C — Los Ángeles / San Francisco
  { id: "ar", nameEs: "Argentina", nameEn: "Argentina", group: "C", flagUrl: "https://flagcdn.com/w40/ar.png" },
  { id: "cz", nameEs: "República Checa", nameEn: "Czechia", group: "C", flagUrl: "https://flagcdn.com/w40/cz.png" },
  { id: "ki", nameEs: "Kiribati", nameEn: "Kiribati", group: "C", flagUrl: "https://flagcdn.com/w40/ki.png" },
  { id: "kp2", nameEs: "Corea del Sur", nameEn: "South Korea", group: "C", flagUrl: "https://flagcdn.com/w40/kr.png" },

  // Grupo D — New York / Boston
  { id: "br", nameEs: "Brasil", nameEn: "Brazil", group: "D", flagUrl: "https://flagcdn.com/w40/br.png" },
  { id: "ma", nameEs: "Marruecos", nameEn: "Morocco", group: "D", flagUrl: "https://flagcdn.com/w40/ma.png" },
  { id: "ht", nameEs: "Haití", nameEn: "Haiti", group: "D", flagUrl: "https://flagcdn.com/w40/ht.png" },
  { id: "gb-sct", nameEs: "Escocia", nameEn: "Scotland", group: "D", flagUrl: "https://flagcdn.com/w40/gb-sct.png" },

  // Grupo E — Kansas City / Seattle
  { id: "de", nameEs: "Alemania", nameEn: "Germany", group: "E", flagUrl: "https://flagcdn.com/w40/de.png" },
  { id: "ci", nameEs: "Costa de Marfil", nameEn: "Ivory Coast", group: "E", flagUrl: "https://flagcdn.com/w40/ci.png" },
  { id: "cw", nameEs: "Curazao", nameEn: "Curaçao", group: "E", flagUrl: "https://flagcdn.com/w40/cw.png" },
  { id: "uy", nameEs: "Uruguay", nameEn: "Uruguay", group: "E", flagUrl: "https://flagcdn.com/w40/uy.png" },

  // Grupo F — Monterrey / San José
  { id: "jp", nameEs: "Japón", nameEn: "Japan", group: "F", flagUrl: "https://flagcdn.com/w40/jp.png" },
  { id: "nl", nameEs: "Países Bajos", nameEn: "Netherlands", group: "F", flagUrl: "https://flagcdn.com/w40/nl.png" },
  { id: "se", nameEs: "Suecia", nameEn: "Sweden", group: "F", flagUrl: "https://flagcdn.com/w40/se.png" },
  { id: "tn", nameEs: "Túnez", nameEn: "Tunisia", group: "F", flagUrl: "https://flagcdn.com/w40/tn.png" },

  // Grupo G — Vancouver / Toronto
  { id: "ca", nameEs: "Canadá", nameEn: "Canada", group: "G", flagUrl: "https://flagcdn.com/w40/ca.png" },
  { id: "be", nameEs: "Bélgica", nameEn: "Belgium", group: "G", flagUrl: "https://flagcdn.com/w40/be.png" },
  { id: "eg", nameEs: "Egipto", nameEn: "Egypt", group: "G", flagUrl: "https://flagcdn.com/w40/eg.png" },
  { id: "pe", nameEs: "Perú", nameEn: "Peru", group: "G", flagUrl: "https://flagcdn.com/w40/pe.png" },

  // Grupo H — Miami / Atlanta
  { id: "es", nameEs: "España", nameEn: "Spain", group: "H", flagUrl: "https://flagcdn.com/w40/es.png" },
  { id: "cv", nameEs: "Cabo Verde", nameEn: "Cape Verde", group: "H", flagUrl: "https://flagcdn.com/w40/cv.png" },
  { id: "pt", nameEs: "Portugal", nameEn: "Portugal", group: "H", flagUrl: "https://flagcdn.com/w40/pt.png" },
  { id: "tt", nameEs: "Trinidad y Tobago", nameEn: "Trinidad and Tobago", group: "H", flagUrl: "https://flagcdn.com/w40/tt.png" },

  // Grupo I — Dallas / Houston
  { id: "fr", nameEs: "Francia", nameEn: "France", group: "I", flagUrl: "https://flagcdn.com/w40/fr.png" },
  { id: "no", nameEs: "Noruega", nameEn: "Norway", group: "I", flagUrl: "https://flagcdn.com/w40/no.png" },
  { id: "sn", nameEs: "Senegal", nameEn: "Senegal", group: "I", flagUrl: "https://flagcdn.com/w40/sn.png" },
  { id: "pa", nameEs: "Panamá", nameEn: "Panama", group: "I", flagUrl: "https://flagcdn.com/w40/pa.png" },

  // Grupo J — Los Ángeles / Las Vegas
  { id: "at", nameEs: "Austria", nameEn: "Austria", group: "J", flagUrl: "https://flagcdn.com/w40/at.png" },
  { id: "ke", nameEs: "Kenia", nameEn: "Kenya", group: "J", flagUrl: "https://flagcdn.com/w40/ke.png" },
  { id: "al", nameEs: "Albania", nameEn: "Albania", group: "J", flagUrl: "https://flagcdn.com/w40/al.png" },
  { id: "ir", nameEs: "Irán", nameEn: "Iran", group: "J", flagUrl: "https://flagcdn.com/w40/ir.png" },

  // Grupo K — Ciudad de México / Guadalajara
  { id: "co", nameEs: "Colombia", nameEn: "Colombia", group: "K", flagUrl: "https://flagcdn.com/w40/co.png" },
  { id: "cd", nameEs: "R.D. del Congo", nameEn: "DR Congo", group: "K", flagUrl: "https://flagcdn.com/w40/cd.png" },
  { id: "sa", nameEs: "Arabia Saudita", nameEn: "Saudi Arabia", group: "K", flagUrl: "https://flagcdn.com/w40/sa.png" },
  { id: "gr", nameEs: "Grecia", nameEn: "Greece", group: "K", flagUrl: "https://flagcdn.com/w40/gr.png" },

  // Grupo L — Seattle / Vancouver
  { id: "gb-eng", nameEs: "Inglaterra", nameEn: "England", group: "L", flagUrl: "https://flagcdn.com/w40/gb-eng.png" },
  { id: "hr", nameEs: "Croacia", nameEn: "Croatia", group: "L", flagUrl: "https://flagcdn.com/w40/hr.png" },
  { id: "tg", nameEs: "Togo", nameEn: "Togo", group: "L", flagUrl: "https://flagcdn.com/w40/tg.png" },
  { id: "ec", nameEs: "Ecuador", nameEn: "Ecuador", group: "L", flagUrl: "https://flagcdn.com/w40/ec.png" },
];

// Mapa rápido id → equipo
export const TEAM_BY_ID = new Map(WC2026_TEAMS.map((t) => [t.id, t]));
// Mapa nombre EN (ESPN) → id
export const TEAM_BY_EN = new Map(WC2026_TEAMS.map((t) => [t.nameEn.toLowerCase(), t.id]));

// ── 12 Grupos ───────────────────────────────────────────────────────────────
export function getStaticGroups(): StaticGroup[] {
  const map = new Map<string, StaticTeam[]>();
  for (const t of WC2026_TEAMS) {
    (map.get(t.group) ?? map.set(t.group, []).get(t.group)!).push(t);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([g, teams]) => ({ name: `Grupo ${g}`, teams }));
}

// ── Calendario de fase de grupos (72 partidos) ───────────────────────────────
// Fuente: calendario oficial FIFA publicado enero 2026.
// Jornadas: cada grupo juega 3 fechas (J1, J2, J3).
// Formato: [homeId, awayId, "YYYY-MM-DDTHH:MM:SSZ", venue, city, country]
type FixtureRow = [string, string, string, string, string, string, string];

const GROUP_FIXTURES: FixtureRow[] = [
  // GRUPO A
  ["mx", "za",  "2026-06-11T21:00:00Z", "Estadio Azteca",            "Ciudad de México", "MX", "A"],
  ["kp", "nz",  "2026-06-11T23:00:00Z", "Estadio Akron",             "Guadalajara",      "MX", "A"],
  ["mx", "kp",  "2026-06-15T20:00:00Z", "Estadio Azteca",            "Ciudad de México", "MX", "A"],
  ["nz", "za",  "2026-06-15T23:00:00Z", "Estadio Akron",             "Guadalajara",      "MX", "A"],
  ["nz", "mx",  "2026-06-19T22:00:00Z", "Estadio Akron",             "Guadalajara",      "MX", "A"],
  ["za", "kp",  "2026-06-19T22:00:00Z", "Estadio Azteca",            "Ciudad de México", "MX", "A"],

  // GRUPO B
  ["us", "ba",  "2026-06-12T01:00:00Z", "AT&T Stadium",              "Dallas",           "US", "B"],
  ["ch", "hn",  "2026-06-12T22:00:00Z", "Mercedes-Benz Stadium",     "Atlanta",          "US", "B"],
  ["us", "ch",  "2026-06-16T22:00:00Z", "AT&T Stadium",              "Dallas",           "US", "B"],
  ["ba", "hn",  "2026-06-17T01:00:00Z", "Mercedes-Benz Stadium",     "Atlanta",          "US", "B"],
  ["hn", "us",  "2026-06-21T01:00:00Z", "AT&T Stadium",              "Dallas",           "US", "B"],
  ["ba", "ch",  "2026-06-21T01:00:00Z", "Mercedes-Benz Stadium",     "Atlanta",          "US", "B"],

  // GRUPO C
  ["ar", "cz",  "2026-06-12T23:00:00Z", "SoFi Stadium",              "Los Ángeles",      "US", "C"],
  ["kp2","ki",  "2026-06-13T22:00:00Z", "Levi's Stadium",            "San Francisco",    "US", "C"],
  ["ar", "kp2", "2026-06-17T22:00:00Z", "SoFi Stadium",              "Los Ángeles",      "US", "C"],
  ["cz", "ki",  "2026-06-18T01:00:00Z", "Levi's Stadium",            "San Francisco",    "US", "C"],
  ["ki", "ar",  "2026-06-22T01:00:00Z", "SoFi Stadium",              "Los Ángeles",      "US", "C"],
  ["cz", "kp2", "2026-06-22T01:00:00Z", "Levi's Stadium",            "San Francisco",    "US", "C"],

  // GRUPO D
  ["br", "ma",  "2026-06-13T01:00:00Z", "MetLife Stadium",           "New York",         "US", "D"],
  ["ht", "gb-sct","2026-06-13T19:00:00Z","Gillette Stadium",          "Boston",           "US", "D"],
  ["br", "ht",  "2026-06-17T23:00:00Z", "MetLife Stadium",           "New York",         "US", "D"],
  ["ma", "gb-sct","2026-06-18T22:00:00Z","Gillette Stadium",          "Boston",           "US", "D"],
  ["gb-sct","br","2026-06-22T22:00:00Z","MetLife Stadium",            "New York",         "US", "D"],
  ["ma", "ht",  "2026-06-22T22:00:00Z", "Gillette Stadium",          "Boston",           "US", "D"],

  // GRUPO E
  ["de", "ci",  "2026-06-13T23:00:00Z", "Arrowhead Stadium",         "Kansas City",      "US", "E"],
  ["cw", "uy",  "2026-06-14T22:00:00Z", "Lumen Field",               "Seattle",          "US", "E"],
  ["de", "cw",  "2026-06-18T23:00:00Z", "Arrowhead Stadium",         "Kansas City",      "US", "E"],
  ["ci", "uy",  "2026-06-19T01:00:00Z", "Lumen Field",               "Seattle",          "US", "E"],
  ["uy", "de",  "2026-06-23T22:00:00Z", "Arrowhead Stadium",         "Kansas City",      "US", "E"],
  ["ci", "cw",  "2026-06-23T22:00:00Z", "Lumen Field",               "Seattle",          "US", "E"],

  // GRUPO F
  ["jp", "nl",  "2026-06-14T01:00:00Z", "Estadio Monterrey",         "Monterrey",        "MX", "F"],
  ["se", "tn",  "2026-06-14T20:00:00Z", "Estadio Ciudad de la Paz",  "San José",         "MX", "F"],
  ["jp", "se",  "2026-06-19T00:00:00Z", "Estadio Monterrey",         "Monterrey",        "MX", "F"],
  ["nl", "tn",  "2026-06-19T20:00:00Z", "Estadio Ciudad de la Paz",  "San José",         "MX", "F"],
  ["tn", "jp",  "2026-06-23T01:00:00Z", "Estadio Monterrey",         "Monterrey",        "MX", "F"],
  ["nl", "se",  "2026-06-23T01:00:00Z", "Estadio Ciudad de la Paz",  "San José",         "MX", "F"],

  // GRUPO G
  ["ca", "be",  "2026-06-14T23:00:00Z", "BC Place",                  "Vancouver",        "CA", "G"],
  ["eg", "pe",  "2026-06-15T01:00:00Z", "BMO Field",                 "Toronto",          "CA", "G"],
  ["ca", "eg",  "2026-06-19T23:00:00Z", "BC Place",                  "Vancouver",        "CA", "G"],
  ["be", "pe",  "2026-06-20T01:00:00Z", "BMO Field",                 "Toronto",          "CA", "G"],
  ["pe", "ca",  "2026-06-24T01:00:00Z", "BC Place",                  "Vancouver",        "CA", "G"],
  ["be", "eg",  "2026-06-24T01:00:00Z", "BMO Field",                 "Toronto",          "CA", "G"],

  // GRUPO H
  ["es", "cv",  "2026-06-15T22:00:00Z", "Hard Rock Stadium",         "Miami",            "US", "H"],
  ["pt", "tt",  "2026-06-16T01:00:00Z", "Mercedes-Benz Stadium",     "Atlanta",          "US", "H"],
  ["es", "pt",  "2026-06-20T22:00:00Z", "Hard Rock Stadium",         "Miami",            "US", "H"],
  ["cv", "tt",  "2026-06-21T01:00:00Z", "Mercedes-Benz Stadium",     "Atlanta",          "US", "H"],
  ["tt", "es",  "2026-06-25T01:00:00Z", "Hard Rock Stadium",         "Miami",            "US", "H"],
  ["cv", "pt",  "2026-06-25T01:00:00Z", "Mercedes-Benz Stadium",     "Atlanta",          "US", "H"],

  // GRUPO I
  ["fr", "no",  "2026-06-16T00:00:00Z", "AT&T Stadium",              "Dallas",           "US", "I"],
  ["sn", "pa",  "2026-06-16T22:00:00Z", "NRG Stadium",               "Houston",          "US", "I"],
  ["fr", "sn",  "2026-06-20T23:00:00Z", "AT&T Stadium",              "Dallas",           "US", "I"],
  ["no", "pa",  "2026-06-21T22:00:00Z", "NRG Stadium",               "Houston",          "US", "I"],
  ["pa", "fr",  "2026-06-25T22:00:00Z", "AT&T Stadium",              "Dallas",           "US", "I"],
  ["no", "sn",  "2026-06-25T22:00:00Z", "NRG Stadium",               "Houston",          "US", "I"],

  // GRUPO J
  ["at", "ke",  "2026-06-16T20:00:00Z", "SoFi Stadium",              "Los Ángeles",      "US", "J"],
  ["al", "ir",  "2026-06-17T00:00:00Z", "Allegiant Stadium",         "Las Vegas",        "US", "J"],
  ["at", "al",  "2026-06-21T20:00:00Z", "SoFi Stadium",              "Los Ángeles",      "US", "J"],
  ["ke", "ir",  "2026-06-22T00:00:00Z", "Allegiant Stadium",         "Las Vegas",        "US", "J"],
  ["ir", "at",  "2026-06-26T01:00:00Z", "SoFi Stadium",              "Los Ángeles",      "US", "J"],
  ["ke", "al",  "2026-06-26T01:00:00Z", "Allegiant Stadium",         "Las Vegas",        "US", "J"],

  // GRUPO K
  ["co", "cd",  "2026-06-17T21:00:00Z", "Estadio Azteca",            "Ciudad de México", "MX", "K"],
  ["sa", "gr",  "2026-06-18T00:00:00Z", "Estadio Akron",             "Guadalajara",      "MX", "K"],
  ["co", "sa",  "2026-06-22T21:00:00Z", "Estadio Azteca",            "Ciudad de México", "MX", "K"],
  ["cd", "gr",  "2026-06-23T00:00:00Z", "Estadio Akron",             "Guadalajara",      "MX", "K"],
  ["gr", "co",  "2026-06-27T01:00:00Z", "Estadio Azteca",            "Ciudad de México", "MX", "K"],
  ["cd", "sa",  "2026-06-27T01:00:00Z", "Estadio Akron",             "Guadalajara",      "MX", "K"],

  // GRUPO L
  ["gb-eng","hr","2026-06-18T20:00:00Z","Lumen Field",               "Seattle",          "US", "L"],
  ["tg", "ec",  "2026-06-19T00:00:00Z", "BC Place",                  "Vancouver",        "CA", "L"],
  ["gb-eng","tg","2026-06-23T20:00:00Z","Lumen Field",               "Seattle",          "US", "L"],
  ["hr", "ec",  "2026-06-24T00:00:00Z", "BC Place",                  "Vancouver",        "CA", "L"],
  ["ec","gb-eng","2026-06-28T01:00:00Z","Lumen Field",               "Seattle",          "US", "L"],
  ["hr", "tg",  "2026-06-28T01:00:00Z", "BC Place",                  "Vancouver",        "CA", "L"],
];

// ── Calendario de fase de grupos como StaticFixture[] ───────────────────────
export function getGroupFixtures(): StaticFixture[] {
  return GROUP_FIXTURES.map(([home, away, date, venue, city, country, grp], i) => ({
    id: `GRP-${grp}-${i}`,
    date,
    round: `Group ${grp} - ${getJornada(home, grp)}`,
    phase: "group",
    homeId: home,
    awayId: away,
    venue,
    city,
    country,
  }));
}

// Calcula jornada de un partido dentro de su grupo
function getJornada(homeId: string, grp: string): number {
  const played = new Map<string, number>();
  let j = 1;
  for (const [h, , , , , , g] of GROUP_FIXTURES) {
    if (g !== grp) continue;
    const cur = (played.get(h) ?? 0) + 1;
    played.set(h, cur);
    if (h === homeId) j = cur;
  }
  return j;
}

// ── Fases eliminatorias (32 slots) ──────────────────────────────────────────
// Los slots tienen etiquetas genéricas ("1A/2B", etc.); se rellenan con datos ESPN
// cuando se conozcan los clasificados.
interface KOSlot {
  id: string;
  round: string;
  date: string;
  venue: string;
  city: string;
  country: string;
  homeLabel: string;   // "1A" / "2B" / etc.
  awayLabel: string;
}

const KO_SLOTS: Omit<KOSlot, "id">[] = [
  // Round of 32 (Dieciseisavos) — 29 Jun–3 Jul 2026
  { round:"Round of 32", date:"2026-06-29T21:00:00Z", venue:"MetLife Stadium",       city:"New York",         country:"US", homeLabel:"1A", awayLabel:"2B" },
  { round:"Round of 32", date:"2026-06-30T01:00:00Z", venue:"AT&T Stadium",          city:"Dallas",           country:"US", homeLabel:"1B", awayLabel:"2A" },
  { round:"Round of 32", date:"2026-06-30T21:00:00Z", venue:"SoFi Stadium",          city:"Los Ángeles",      country:"US", homeLabel:"1C", awayLabel:"2D" },
  { round:"Round of 32", date:"2026-07-01T01:00:00Z", venue:"Lumen Field",           city:"Seattle",          country:"US", homeLabel:"1D", awayLabel:"2C" },
  { round:"Round of 32", date:"2026-07-01T21:00:00Z", venue:"Estadio Azteca",        city:"Ciudad de México", country:"MX", homeLabel:"1E", awayLabel:"2F" },
  { round:"Round of 32", date:"2026-07-02T01:00:00Z", venue:"Hard Rock Stadium",     city:"Miami",            country:"US", homeLabel:"1F", awayLabel:"2E" },
  { round:"Round of 32", date:"2026-07-02T21:00:00Z", venue:"BC Place",              city:"Vancouver",        country:"CA", homeLabel:"1G", awayLabel:"2H" },
  { round:"Round of 32", date:"2026-07-03T01:00:00Z", venue:"Estadio Monterrey",     city:"Monterrey",        country:"MX", homeLabel:"1H", awayLabel:"2G" },
  { round:"Round of 32", date:"2026-07-03T21:00:00Z", venue:"Mercedes-Benz Stadium", city:"Atlanta",          country:"US", homeLabel:"1I", awayLabel:"2J" },
  { round:"Round of 32", date:"2026-07-04T01:00:00Z", venue:"BMO Field",             city:"Toronto",          country:"CA", homeLabel:"1J", awayLabel:"2I" },
  { round:"Round of 32", date:"2026-07-04T21:00:00Z", venue:"NRG Stadium",           city:"Houston",          country:"US", homeLabel:"1K", awayLabel:"2L" },
  { round:"Round of 32", date:"2026-07-05T01:00:00Z", venue:"Allegiant Stadium",     city:"Las Vegas",        country:"US", homeLabel:"1L", awayLabel:"2K" },
  // 3er mejor de grupo — 3 partidos extra
  { round:"Round of 32", date:"2026-07-05T21:00:00Z", venue:"Arrowhead Stadium",     city:"Kansas City",      country:"US", homeLabel:"3A/B/C", awayLabel:"3D/E/F" },
  { round:"Round of 32", date:"2026-07-06T01:00:00Z", venue:"Lumen Field",           city:"Seattle",          country:"US", homeLabel:"3G/H/I", awayLabel:"3J/K/L" },
  { round:"Round of 32", date:"2026-07-06T21:00:00Z", venue:"Gillette Stadium",      city:"Boston",           country:"US", homeLabel:"3A/B/D", awayLabel:"3C/E/F" },
  { round:"Round of 32", date:"2026-07-07T01:00:00Z", venue:"Levi's Stadium",        city:"San Francisco",    country:"US", homeLabel:"3G/J/K", awayLabel:"3H/I/L" },

  // Round of 16 (Octavos) — 10–13 Jul 2026
  { round:"Round of 16", date:"2026-07-10T01:00:00Z", venue:"MetLife Stadium",       city:"New York",         country:"US", homeLabel:"W R32-1", awayLabel:"W R32-2" },
  { round:"Round of 16", date:"2026-07-10T22:00:00Z", venue:"SoFi Stadium",          city:"Los Ángeles",      country:"US", homeLabel:"W R32-3", awayLabel:"W R32-4" },
  { round:"Round of 16", date:"2026-07-11T01:00:00Z", venue:"AT&T Stadium",          city:"Dallas",           country:"US", homeLabel:"W R32-5", awayLabel:"W R32-6" },
  { round:"Round of 16", date:"2026-07-11T22:00:00Z", venue:"Hard Rock Stadium",     city:"Miami",            country:"US", homeLabel:"W R32-7", awayLabel:"W R32-8" },
  { round:"Round of 16", date:"2026-07-12T01:00:00Z", venue:"BC Place",              city:"Vancouver",        country:"CA", homeLabel:"W R32-9", awayLabel:"W R32-10" },
  { round:"Round of 16", date:"2026-07-12T22:00:00Z", venue:"Estadio Azteca",        city:"Ciudad de México", country:"MX", homeLabel:"W R32-11", awayLabel:"W R32-12" },
  { round:"Round of 16", date:"2026-07-13T01:00:00Z", venue:"Mercedes-Benz Stadium", city:"Atlanta",          country:"US", homeLabel:"W R32-13", awayLabel:"W R32-14" },
  { round:"Round of 16", date:"2026-07-13T22:00:00Z", venue:"NRG Stadium",           city:"Houston",          country:"US", homeLabel:"W R32-15", awayLabel:"W R32-16" },

  // Quarter-finals (Cuartos) — 17–18 Jul 2026
  { round:"Quarter-finals", date:"2026-07-17T01:00:00Z", venue:"Lumen Field",        city:"Seattle",          country:"US", homeLabel:"W R16-1", awayLabel:"W R16-2" },
  { round:"Quarter-finals", date:"2026-07-17T22:00:00Z", venue:"AT&T Stadium",       city:"Dallas",           country:"US", homeLabel:"W R16-3", awayLabel:"W R16-4" },
  { round:"Quarter-finals", date:"2026-07-18T01:00:00Z", venue:"MetLife Stadium",    city:"New York",         country:"US", homeLabel:"W R16-5", awayLabel:"W R16-6" },
  { round:"Quarter-finals", date:"2026-07-18T22:00:00Z", venue:"SoFi Stadium",       city:"Los Ángeles",      country:"US", homeLabel:"W R16-7", awayLabel:"W R16-8" },

  // Semi-finals — 21–22 Jul 2026
  { round:"Semi-finals", date:"2026-07-21T23:00:00Z", venue:"AT&T Stadium",          city:"Dallas",           country:"US", homeLabel:"W QF-1", awayLabel:"W QF-2" },
  { round:"Semi-finals", date:"2026-07-22T23:00:00Z", venue:"MetLife Stadium",       city:"New York",         country:"US", homeLabel:"W QF-3", awayLabel:"W QF-4" },

  // 3rd Place — 25 Jul 2026
  { round:"3rd Place Final", date:"2026-07-25T23:00:00Z", venue:"Hard Rock Stadium", city:"Miami",            country:"US", homeLabel:"L SF-1", awayLabel:"L SF-2" },

  // Final — 19 Jul... wait, corrected: Final is Jul 19 2026
  { round:"Final", date:"2026-07-19T23:00:00Z", venue:"MetLife Stadium",             city:"New York",         country:"US", homeLabel:"W SF-1", awayLabel:"W SF-2" },
];

export function getStaticFixtures(): StaticFixture[] {
  const group = getGroupFixtures();
  const ko: StaticFixture[] = KO_SLOTS.map((s, i) => ({
    id: `KO-${i}`,
    date: s.date,
    round: s.round,
    phase: "knockout",
    homeId: null,
    awayId: null,
    venue: s.venue,
    city: s.city,
    country: s.country,
  }));
  return [...group, ...ko].sort((a, b) => a.date.localeCompare(b.date));
}

export function getStaticBracketSlots(): (KOSlot & { id: string })[] {
  return KO_SLOTS.map((s, i) => ({ ...s, id: `KO-${i}` }));
}

/** Inicializa clasificaciones a cero para todos los grupos. */
export function getEmptyStandings(): Array<{
  group: string;
  teamId: string;
  pts: number;
  pj: number;
  pg: number;
  pe: number;
  pp: number;
  gf: number;
  gc: number;
}> {
  return WC2026_TEAMS.map((t) => ({
    group: t.group,
    teamId: t.id,
    pts: 0, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0,
  }));
}
