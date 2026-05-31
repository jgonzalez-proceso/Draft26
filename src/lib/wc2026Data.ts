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

// Equipos por grupo en orden de sorteo (posición 1..4)
function groupTeams(letter: string): StaticTeam[] {
  return TEAMS.filter((t) => t.group === letter);
}

// ── Fase de grupos: round-robin (72 partidos) ───────────────────────────────
// Fechas base por grupo: 3 jornadas. Se reparten en junio 2026.
const GROUP_DATES: Record<number, string[]> = {
  // jornada -> [fechaPartido1, fechaPartido2] (UTC aprox.)
  1: ["T21:00:00Z", "T23:30:00Z"],
  2: ["T20:00:00Z", "T23:00:00Z"],
  3: ["T22:00:00Z", "T22:00:00Z"],
};

// Día base (J1) por grupo, escalonado como el calendario real (11–18 jun).
const GROUP_START_DAY: Record<string, number> = {
  A: 11, B: 12, C: 12, D: 13, E: 13, F: 14, G: 14, H: 15, I: 16, J: 16, K: 17, L: 18,
};

function getGroupFixtures(): StaticFixture[] {
  const out: StaticFixture[] = [];
  // Emparejamientos por jornada (índices 0..3 de los 4 equipos)
  const SCHEDULE: [number, number][][] = [
    [[0, 1], [2, 3]], // J1
    [[0, 2], [1, 3]], // J2
    [[3, 0], [1, 2]], // J3
  ];
  for (const letter of "ABCDEFGHIJKL".split("")) {
    const teams = groupTeams(letter);
    if (teams.length < 4) continue;
    const startDay = GROUP_START_DAY[letter] ?? 11;
    SCHEDULE.forEach((pairs, j) => {
      const day = startDay + j * 4; // ~4 días entre jornadas
      pairs.forEach(([h, a], idx) => {
        out.push({
          id: `GRP-${letter}-${j}-${idx}`,
          date: `2026-06-${String(day).padStart(2, "0")}${GROUP_DATES[j + 1][idx]}`,
          round: `Group ${letter} - ${j + 1}`,
          phase: "group",
          homeId: teams[h].id,
          awayId: teams[a].id,
          venue: "",
        });
      });
    });
  }
  return out;
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
  { code: "M73", round: "Round of 32", pathway: 1, home: POS(2, "A"), away: POS(2, "B"), date: "2026-06-29T21:00:00Z", venue: "Los Ángeles" },
  { code: "M74", round: "Round of 32", pathway: 1, home: POS(1, "E"), away: THIRD("ABCDF"), date: "2026-06-30T01:00:00Z", venue: "Boston" },
  { code: "M75", round: "Round of 32", pathway: 1, home: POS(1, "F"), away: POS(2, "C"), date: "2026-06-30T21:00:00Z", venue: "Monterrey" },
  { code: "M77", round: "Round of 32", pathway: 1, home: POS(1, "I"), away: THIRD("CDFGH"), date: "2026-07-01T01:00:00Z", venue: "Houston" },
  { code: "M81", round: "Round of 32", pathway: 1, home: POS(1, "D"), away: THIRD("BEFIJ"), date: "2026-07-02T21:00:00Z", venue: "Dallas" },
  { code: "M82", round: "Round of 32", pathway: 1, home: POS(1, "G"), away: THIRD("AEHIJ"), date: "2026-07-03T01:00:00Z", venue: "Vancouver" },
  { code: "M83", round: "Round of 32", pathway: 1, home: POS(2, "K"), away: POS(2, "L"), date: "2026-07-03T21:00:00Z", venue: "Seattle" },
  { code: "M84", round: "Round of 32", pathway: 1, home: POS(1, "H"), away: POS(2, "J"), date: "2026-07-04T01:00:00Z", venue: "Atlanta" },
  { code: "M76", round: "Round of 32", pathway: 2, home: POS(1, "C"), away: POS(2, "F"), date: "2026-07-01T21:00:00Z", venue: "Nueva York" },
  { code: "M78", round: "Round of 32", pathway: 2, home: POS(2, "E"), away: POS(2, "I"), date: "2026-07-02T01:00:00Z", venue: "Filadelfia" },
  { code: "M79", round: "Round of 32", pathway: 2, home: POS(1, "A"), away: THIRD("CEFHI"), date: "2026-07-04T21:00:00Z", venue: "Ciudad de México" },
  { code: "M80", round: "Round of 32", pathway: 2, home: POS(1, "L"), away: THIRD("EHIJK"), date: "2026-07-05T01:00:00Z", venue: "Kansas City" },
  { code: "M85", round: "Round of 32", pathway: 2, home: POS(1, "B"), away: THIRD("EFGIJ"), date: "2026-07-05T21:00:00Z", venue: "San Francisco" },
  { code: "M86", round: "Round of 32", pathway: 2, home: POS(1, "J"), away: POS(2, "H"), date: "2026-07-06T01:00:00Z", venue: "Miami" },
  { code: "M87", round: "Round of 32", pathway: 2, home: POS(1, "K"), away: THIRD("DEIJL"), date: "2026-07-06T21:00:00Z", venue: "Toronto" },
  { code: "M88", round: "Round of 32", pathway: 2, home: POS(2, "D"), away: POS(2, "G"), date: "2026-07-07T01:00:00Z", venue: "Guadalajara" },

  // ── Octavos (R16) ──
  { code: "M89", round: "Round of 16", pathway: 1, home: WIN("M74"), away: WIN("M77"), date: "2026-07-11T21:00:00Z", venue: "Filadelfia" },
  { code: "M90", round: "Round of 16", pathway: 1, home: WIN("M73"), away: WIN("M75"), date: "2026-07-11T01:00:00Z", venue: "Houston" },
  { code: "M93", round: "Round of 16", pathway: 1, home: WIN("M83"), away: WIN("M84"), date: "2026-07-13T01:00:00Z", venue: "Seattle" },
  { code: "M94", round: "Round of 16", pathway: 1, home: WIN("M81"), away: WIN("M82"), date: "2026-07-12T21:00:00Z", venue: "Los Ángeles" },
  { code: "M91", round: "Round of 16", pathway: 2, home: WIN("M76"), away: WIN("M78"), date: "2026-07-12T01:00:00Z", venue: "Nueva York" },
  { code: "M92", round: "Round of 16", pathway: 2, home: WIN("M79"), away: WIN("M80"), date: "2026-07-13T21:00:00Z", venue: "Ciudad de México" },
  { code: "M95", round: "Round of 16", pathway: 2, home: WIN("M86"), away: WIN("M88"), date: "2026-07-14T01:00:00Z", venue: "Dallas" },
  { code: "M96", round: "Round of 16", pathway: 2, home: WIN("M85"), away: WIN("M87"), date: "2026-07-14T21:00:00Z", venue: "Atlanta" },

  // ── Cuartos (QF) ──
  { code: "M97", round: "Quarter-finals", pathway: 1, home: WIN("M89"), away: WIN("M90"), date: "2026-07-17T01:00:00Z", venue: "Boston" },
  { code: "M98", round: "Quarter-finals", pathway: 1, home: WIN("M93"), away: WIN("M94"), date: "2026-07-18T01:00:00Z", venue: "Los Ángeles" },
  { code: "M99", round: "Quarter-finals", pathway: 2, home: WIN("M91"), away: WIN("M92"), date: "2026-07-17T21:00:00Z", venue: "Kansas City" },
  { code: "M100", round: "Quarter-finals", pathway: 2, home: WIN("M95"), away: WIN("M96"), date: "2026-07-18T21:00:00Z", venue: "Miami" },

  // ── Semifinales (SF) ──
  { code: "M101", round: "Semi-finals", pathway: 1, home: WIN("M97"), away: WIN("M98"), date: "2026-07-21T23:00:00Z", venue: "Dallas" },
  { code: "M102", round: "Semi-finals", pathway: 2, home: WIN("M99"), away: WIN("M100"), date: "2026-07-22T23:00:00Z", venue: "Atlanta" },

  // ── 3.º puesto y Final ──
  { code: "M103", round: "3rd Place Final", pathway: "final", home: LOSE("M101"), away: LOSE("M102"), date: "2026-07-25T20:00:00Z", venue: "Miami" },
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
