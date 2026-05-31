/**
 * Datos estáticos del Mundial 2026 (Canadá/México/USA).
 * Fuente única de equipos/grupos: `wc2026Teams.ts` (sorteo real FIFA 5-dic-2025).
 *
 * - Fase de grupos: round-robin por grupo (J1: 1-2,3-4 · J2: 1-3,2-4 · J3: 1-4,2-3).
 * - Eliminatorias: cuadro oficial FIFA (M73–M104) con etiquetas de posición legibles.
 *   Los partidos de eliminatoria van con homeId/awayId null + homeLabel/awayLabel.
 */

import { WC2026_TEAMS as TEAMS, type Wc2026Team } from "./wc2026Teams";

export type StaticTeam = Wc2026Team;
export const WC2026_TEAMS = TEAMS;
export const TEAM_BY_ID = new Map(TEAMS.map((t) => [t.id, t]));
export const TEAM_BY_EN = new Map(TEAMS.map((t) => [t.nameEn.toLowerCase(), t.id]));

export interface StaticFixture {
  id: string;
  date: string;
  round: string; // "Group A - 1" / "Round of 32" / etc.
  phase: "group" | "knockout";
  homeId: string | null;
  awayId: string | null;
  homeLabel?: string; // etiqueta de posición cuando aún no hay equipo (eliminatorias)
  awayLabel?: string;
  venue: string;
  matchCode?: string; // M73 … M104
}

export interface StaticGroup {
  name: string; // "Grupo A"
  teams: StaticTeam[];
}

// ── 12 Grupos ───────────────────────────────────────────────────────────────
export function getStaticGroups(): StaticGroup[] {
  const map = new Map<string, StaticTeam[]>();
  for (const t of TEAMS) {
    (map.get(t.group) ?? map.set(t.group, []).get(t.group)!).push(t);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([g, teams]) => ({ name: `Grupo ${g}`, teams }));
}

// ── Fase de grupos: calendario real (72 partidos) ───────────────────────────
// Fechas base por grupo: 3 jornadas. Se reparten en junio 2026.
// Calendario REAL de fase de grupos (horarios exactos en UTC, vía ESPN/FIFA).
// Formato: [localId, visitanteId, fechaUTC, jornada]. Se muestran en hora de
// España (Europe/Madrid) en la UI.
type GRow = [string, string, string, number];
const REAL_GROUP: GRow[] = [
  ["mx", "za", "2026-06-11T19:00:00Z", 1],
  ["kr", "cz", "2026-06-12T02:00:00Z", 1],
  ["cz", "za", "2026-06-18T16:00:00Z", 2],
  ["mx", "kr", "2026-06-19T01:00:00Z", 2],
  ["cz", "mx", "2026-06-25T01:00:00Z", 3],
  ["za", "kr", "2026-06-25T01:00:00Z", 3],
  ["ca", "ba", "2026-06-12T19:00:00Z", 1],
  ["qa", "ch", "2026-06-13T19:00:00Z", 1],
  ["ch", "ba", "2026-06-18T19:00:00Z", 2],
  ["ca", "qa", "2026-06-18T22:00:00Z", 2],
  ["ba", "qa", "2026-06-24T19:00:00Z", 3],
  ["ch", "ca", "2026-06-24T19:00:00Z", 3],
  ["br", "ma", "2026-06-13T22:00:00Z", 1],
  ["ht", "gb-sct", "2026-06-14T01:00:00Z", 1],
  ["gb-sct", "ma", "2026-06-19T22:00:00Z", 2],
  ["br", "ht", "2026-06-20T00:30:00Z", 2],
  ["gb-sct", "br", "2026-06-24T22:00:00Z", 3],
  ["ma", "ht", "2026-06-24T22:00:00Z", 3],
  ["us", "py", "2026-06-13T01:00:00Z", 1],
  ["au", "tr", "2026-06-14T04:00:00Z", 1],
  ["us", "au", "2026-06-19T19:00:00Z", 2],
  ["tr", "py", "2026-06-20T03:00:00Z", 2],
  ["py", "au", "2026-06-26T02:00:00Z", 3],
  ["tr", "us", "2026-06-26T02:00:00Z", 3],
  ["de", "cw", "2026-06-14T17:00:00Z", 1],
  ["ci", "ec", "2026-06-14T23:00:00Z", 1],
  ["de", "ci", "2026-06-20T20:00:00Z", 2],
  ["ec", "cw", "2026-06-21T00:00:00Z", 2],
  ["cw", "ci", "2026-06-25T20:00:00Z", 3],
  ["ec", "de", "2026-06-25T20:00:00Z", 3],
  ["nl", "jp", "2026-06-14T20:00:00Z", 1],
  ["se", "tn", "2026-06-15T02:00:00Z", 1],
  ["nl", "se", "2026-06-20T17:00:00Z", 2],
  ["tn", "jp", "2026-06-21T04:00:00Z", 2],
  ["jp", "se", "2026-06-25T23:00:00Z", 3],
  ["tn", "nl", "2026-06-25T23:00:00Z", 3],
  ["be", "eg", "2026-06-15T19:00:00Z", 1],
  ["ir", "nz", "2026-06-16T01:00:00Z", 1],
  ["be", "ir", "2026-06-21T19:00:00Z", 2],
  ["nz", "eg", "2026-06-22T01:00:00Z", 2],
  ["eg", "ir", "2026-06-27T03:00:00Z", 3],
  ["nz", "be", "2026-06-27T03:00:00Z", 3],
  ["es", "cv", "2026-06-15T16:00:00Z", 1],
  ["sa", "uy", "2026-06-15T22:00:00Z", 1],
  ["es", "sa", "2026-06-21T16:00:00Z", 2],
  ["uy", "cv", "2026-06-21T22:00:00Z", 2],
  ["cv", "sa", "2026-06-27T00:00:00Z", 3],
  ["uy", "es", "2026-06-27T00:00:00Z", 3],
  ["fr", "sn", "2026-06-16T19:00:00Z", 1],
  ["iq", "no", "2026-06-16T22:00:00Z", 1],
  ["fr", "iq", "2026-06-22T21:00:00Z", 2],
  ["no", "sn", "2026-06-23T00:00:00Z", 2],
  ["no", "fr", "2026-06-26T19:00:00Z", 3],
  ["sn", "iq", "2026-06-26T19:00:00Z", 3],
  ["ar", "dz", "2026-06-17T01:00:00Z", 1],
  ["at", "jo", "2026-06-17T04:00:00Z", 1],
  ["ar", "at", "2026-06-22T17:00:00Z", 2],
  ["jo", "dz", "2026-06-23T03:00:00Z", 2],
  ["dz", "at", "2026-06-28T02:00:00Z", 3],
  ["jo", "ar", "2026-06-28T02:00:00Z", 3],
  ["pt", "cd", "2026-06-17T17:00:00Z", 1],
  ["uz", "co", "2026-06-18T02:00:00Z", 1],
  ["pt", "uz", "2026-06-23T17:00:00Z", 2],
  ["co", "cd", "2026-06-24T02:00:00Z", 2],
  ["cd", "uz", "2026-06-27T23:30:00Z", 3],
  ["co", "pt", "2026-06-27T23:30:00Z", 3],
  ["gb-eng", "hr", "2026-06-17T20:00:00Z", 1],
  ["gh", "pa", "2026-06-17T23:00:00Z", 1],
  ["gb-eng", "gh", "2026-06-23T20:00:00Z", 2],
  ["pa", "hr", "2026-06-23T23:00:00Z", 2],
  ["hr", "gh", "2026-06-27T21:00:00Z", 3],
  ["pa", "gb-eng", "2026-06-27T21:00:00Z", 3],
];

function getGroupFixtures(): StaticFixture[] {
  const seq: Record<string, number> = {};
  return REAL_GROUP.map(([h, a, date, md]) => {
    const g = TEAM_BY_ID.get(h)?.group ?? "?";
    const key = `${g}-${md}`;
    seq[key] = (seq[key] ?? 0) + 1;
    return {
      id: `GRP-${g}-${md}-${seq[key]}`,
      date,
      round: `Group ${g} - ${md}`,
      phase: "group" as const,
      homeId: h,
      awayId: a,
      venue: "",
    };
  });
}

// ── Cuadro oficial de eliminatorias (M73–M104) ──────────────────────────────
// Etiquetas legibles tal y como las fija la FIFA.
const POS = (n: number, g: string) => `${n}.º Grupo ${g}`;
const THIRD = (groups: string) => `3.º (Grupos ${groups.split("").join("/")})`;
const WIN = (m: string) => `Ganador ${m}`;
const LOSE = (m: string) => `Perdedor ${m}`;

interface KoDef {
  code: string;       // M73…
  round: string;      // Round of 32 / Round of 16 / Quarter-finals / Semi-finals / 3rd Place Final / Final
  pathway: 1 | 2 | "final";
  home: string;       // etiqueta legible
  away: string;
  date: string;
  venue: string;
}

// Estructura EXACTA del cuadro FIFA 2026 (imagen oficial).
const BRACKET: KoDef[] = [
  // ── Dieciseisavos (R32) ──
  { code: "M73", round: "Round of 32", pathway: 1, home: POS(2, "A"), away: POS(2, "B"), date: "2026-06-28T19:00:00Z", venue: "Los Ángeles" },
  { code: "M74", round: "Round of 32", pathway: 1, home: POS(1, "E"), away: THIRD("ABCDF"), date: "2026-06-29T20:30:00Z", venue: "Boston" },
  { code: "M75", round: "Round of 32", pathway: 1, home: POS(1, "F"), away: POS(2, "C"), date: "2026-06-30T01:00:00Z", venue: "Monterrey" },
  { code: "M77", round: "Round of 32", pathway: 1, home: POS(1, "I"), away: THIRD("CDFGH"), date: "2026-06-30T21:00:00Z", venue: "Houston" },
  { code: "M81", round: "Round of 32", pathway: 1, home: POS(1, "D"), away: THIRD("BEFIJ"), date: "2026-07-02T00:00:00Z", venue: "Dallas" },
  { code: "M82", round: "Round of 32", pathway: 1, home: POS(1, "G"), away: THIRD("AEHIJ"), date: "2026-07-01T20:00:00Z", venue: "Vancouver" },
  { code: "M83", round: "Round of 32", pathway: 1, home: POS(2, "K"), away: POS(2, "L"), date: "2026-07-02T23:00:00Z", venue: "Seattle" },
  { code: "M84", round: "Round of 32", pathway: 1, home: POS(1, "H"), away: POS(2, "J"), date: "2026-07-02T19:00:00Z", venue: "Atlanta" },
  { code: "M76", round: "Round of 32", pathway: 2, home: POS(1, "C"), away: POS(2, "F"), date: "2026-06-29T17:00:00Z", venue: "Nueva York" },
  { code: "M78", round: "Round of 32", pathway: 2, home: POS(2, "E"), away: POS(2, "I"), date: "2026-06-30T17:00:00Z", venue: "Filadelfia" },
  { code: "M79", round: "Round of 32", pathway: 2, home: POS(1, "A"), away: THIRD("CEFHI"), date: "2026-07-01T01:00:00Z", venue: "Ciudad de México" },
  { code: "M80", round: "Round of 32", pathway: 2, home: POS(1, "L"), away: THIRD("EHIJK"), date: "2026-07-01T16:00:00Z", venue: "Kansas City" },
  { code: "M85", round: "Round of 32", pathway: 2, home: POS(1, "B"), away: THIRD("EFGIJ"), date: "2026-07-03T03:00:00Z", venue: "San Francisco" },
  { code: "M86", round: "Round of 32", pathway: 2, home: POS(1, "J"), away: POS(2, "H"), date: "2026-07-03T22:00:00Z", venue: "Miami" },
  { code: "M87", round: "Round of 32", pathway: 2, home: POS(1, "K"), away: THIRD("DEIJL"), date: "2026-07-04T01:30:00Z", venue: "Toronto" },
  { code: "M88", round: "Round of 32", pathway: 2, home: POS(2, "D"), away: POS(2, "G"), date: "2026-07-03T18:00:00Z", venue: "Guadalajara" },

  // ── Octavos (R16) ──
  { code: "M89", round: "Round of 16", pathway: 1, home: WIN("M74"), away: WIN("M77"), date: "2026-07-04T17:00:00Z", venue: "Filadelfia" },
  { code: "M90", round: "Round of 16", pathway: 1, home: WIN("M73"), away: WIN("M75"), date: "2026-07-04T21:00:00Z", venue: "Houston" },
  { code: "M93", round: "Round of 16", pathway: 1, home: WIN("M83"), away: WIN("M84"), date: "2026-07-06T19:00:00Z", venue: "Seattle" },
  { code: "M94", round: "Round of 16", pathway: 1, home: WIN("M81"), away: WIN("M82"), date: "2026-07-07T00:00:00Z", venue: "Los Ángeles" },
  { code: "M91", round: "Round of 16", pathway: 2, home: WIN("M76"), away: WIN("M78"), date: "2026-07-05T20:00:00Z", venue: "Nueva York" },
  { code: "M92", round: "Round of 16", pathway: 2, home: WIN("M79"), away: WIN("M80"), date: "2026-07-06T00:00:00Z", venue: "Ciudad de México" },
  { code: "M95", round: "Round of 16", pathway: 2, home: WIN("M86"), away: WIN("M88"), date: "2026-07-07T16:00:00Z", venue: "Dallas" },
  { code: "M96", round: "Round of 16", pathway: 2, home: WIN("M85"), away: WIN("M87"), date: "2026-07-07T20:00:00Z", venue: "Atlanta" },

  // ── Cuartos (QF) ──
  { code: "M97", round: "Quarter-finals", pathway: 1, home: WIN("M89"), away: WIN("M90"), date: "2026-07-09T20:00:00Z", venue: "Boston" },
  { code: "M98", round: "Quarter-finals", pathway: 1, home: WIN("M93"), away: WIN("M94"), date: "2026-07-10T19:00:00Z", venue: "Los Ángeles" },
  { code: "M99", round: "Quarter-finals", pathway: 2, home: WIN("M91"), away: WIN("M92"), date: "2026-07-11T21:00:00Z", venue: "Kansas City" },
  { code: "M100", round: "Quarter-finals", pathway: 2, home: WIN("M95"), away: WIN("M96"), date: "2026-07-12T01:00:00Z", venue: "Miami" },

  // ── Semifinales (SF) ──
  { code: "M101", round: "Semi-finals", pathway: 1, home: WIN("M97"), away: WIN("M98"), date: "2026-07-14T19:00:00Z", venue: "Dallas" },
  { code: "M102", round: "Semi-finals", pathway: 2, home: WIN("M99"), away: WIN("M100"), date: "2026-07-15T19:00:00Z", venue: "Atlanta" },

  // ── 3.º puesto y Final ──
  { code: "M103", round: "3rd Place Final", pathway: "final", home: LOSE("M101"), away: LOSE("M102"), date: "2026-07-18T21:00:00Z", venue: "Miami" },
  { code: "M104", round: "Final", pathway: "final", home: WIN("M101"), away: WIN("M102"), date: "2026-07-19T19:00:00Z", venue: "Nueva York" },
];

export type BracketMatch = KoDef;
export function getBracket(): BracketMatch[] {
  return BRACKET;
}

function knockoutFixtures(): StaticFixture[] {
  return BRACKET.map((k) => ({
    id: `KO-${k.code}`,
    date: k.date,
    round: k.round,
    phase: "knockout" as const,
    homeId: null,
    awayId: null,
    homeLabel: k.home,
    awayLabel: k.away,
    venue: k.venue,
    matchCode: k.code,
  }));
}

export function getStaticFixtures(): StaticFixture[] {
  return [...getGroupFixtures(), ...knockoutFixtures()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}
