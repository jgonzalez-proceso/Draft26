/**
 * Cliente ESPN Public API para el Mundial 2026.
 * Sin autenticación — completamente gratuito.
 * Sólo se llama en el servidor (Server Components / route handlers).
 *
 * Fuente: https://site.api.espn.com/apis/site/v2/sports/soccer/FIFA.WORLD/
 * (API pública no oficial, ampliamente utilizada.)
 */

import {
  WC2026_TEAMS,
  TEAM_BY_EN,
  type StaticFixture,
  type StaticTeam,
} from "./wc2026Data";

const ESPN_BASE =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/FIFA.WORLD";

// ── Tipos normalizados que consume la UI ────────────────────────────────────

export interface EspnTeam {
  espnId: string;
  name: string;
  abbr: string;
  logo: string;
  staticId: string | null; // id de wc2026Data, null si no se mapea
}

export interface LiveFixture {
  espnId: string;
  date: string;
  round: string;           // grupo o fase
  statusShort: string;     // "pre" | "in" | "post"
  statusLabel: string;     // "Scheduled" | "1st Half" | "Half Time" | "Full Time" …
  elapsed: number | null;
  home: EspnTeam & { score: number | null; winner: boolean };
  away: EspnTeam & { score: number | null; winner: boolean };
  venue: string;
}

export interface GoalEvent {
  elapsed: number | null;
  teamAbbr: string;
  player: string;
  type: string; // "goal" | "penalty" | "ownGoal"
}

// ── API helpers ─────────────────────────────────────────────────────────────



interface RawComp {
  id: string;
  startDate: string;
  status: { type: { id: string; name: string; state: string; completed: boolean; description: string } };
  venue?: { fullName?: string };
  competitors: RawCompetitor[];
  notes?: { headline?: string }[];
}

interface RawCompetitor {
  homeAway: "home" | "away";
  score: string;
  winner?: boolean;
  team: { id: string; displayName: string; abbreviation: string; logo: string };
}

function mapCompetitor(
  c: RawCompetitor,
): EspnTeam & { score: number | null; winner: boolean } {
  const name = c.team.displayName;
  const staticId = TEAM_BY_EN.get(name.toLowerCase()) ?? null;
  const logo = staticId
    ? (WC2026_TEAMS.find((t) => t.id === staticId)?.flagUrl ?? c.team.logo)
    : c.team.logo;
  return {
    espnId: c.team.id,
    name,
    abbr: c.team.abbreviation,
    logo,
    staticId,
    score: c.score ? Number(c.score) : null,
    winner: c.winner ?? false,
  };
}

function parseRound(event: { name: string; competitions: RawComp[] }): string {
  // ESPN codifica el grupo en notes[0].headline o en el event name
  const note = event.competitions[0]?.notes?.[0]?.headline ?? "";
  if (/group/i.test(note)) return note; // "Group A"
  if (/round of 32/i.test(event.name)) return "Round of 32";
  if (/round of 16/i.test(event.name)) return "Round of 16";
  if (/quarterfinal/i.test(event.name)) return "Quarter-finals";
  if (/semifinal/i.test(event.name)) return "Semi-finals";
  if (/3rd/i.test(event.name)) return "3rd Place Final";
  if (/final/i.test(event.name)) return "Final";
  return event.name;
}

function parseLiveFixture(event: {
  id: string;
  date: string;
  name: string;
  competitions: RawComp[];
  status: { type: { state: string; description: string } };
}): LiveFixture | null {
  const comp = event.competitions[0];
  if (!comp) return null;
  const home = comp.competitors.find((c) => c.homeAway === "home");
  const away = comp.competitors.find((c) => c.homeAway === "away");
  if (!home || !away) return null;

  const statusState = event.status.type.state;
  const elapsed = (() => {
    const m = event.status.type.description.match(/(\d+)/);
    return m ? Number(m[1]) : null;
  })();

  return {
    espnId: comp.id,
    date: comp.startDate,
    round: parseRound(event),
    statusShort: statusState,       // "pre" | "in" | "post"
    statusLabel: event.status.type.description,
    elapsed: statusState === "in" ? elapsed : null,
    home: mapCompetitor(home),
    away: mapCompetitor(away),
    venue: comp.venue?.fullName ?? "",
  };
}

// ── Endpoints públicos ───────────────────────────────────────────────────────

/** Todos los partidos del scoreboard de hoy (+ live). */
export async function getEspnScoreboard(): Promise<LiveFixture[]> {
  try {
    const res = await fetch(`${ESPN_BASE}/scoreboard`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const d = (await res.json()) as {
      events?: Parameters<typeof parseLiveFixture>[0][];
    };
    return (d.events ?? []).flatMap((e) => {
      const f = parseLiveFixture(e);
      return f ? [f] : [];
    });
  } catch {
    return [];
  }
}

/** Partidos de una fecha concreta (YYYYMMDD). */
export async function getEspnFixturesByDate(
  date: string,
): Promise<LiveFixture[]> {
  try {
    const res = await fetch(`${ESPN_BASE}/scoreboard?dates=${date}`, {
      next: { revalidate: 120 },
    });
    if (!res.ok) return [];
    const d = (await res.json()) as {
      events?: Parameters<typeof parseLiveFixture>[0][];
    };
    return (d.events ?? []).flatMap((e) => {
      const f = parseLiveFixture(e);
      return f ? [f] : [];
    });
  } catch {
    return [];
  }
}

/** Goleadores de un partido concreto (espnId = comp.id). */
export async function getEspnGoals(espnId: string): Promise<GoalEvent[]> {
  try {
    const res = await fetch(`${ESPN_BASE}/summary?event=${espnId}`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) return [];
    const d = (await res.json()) as {
      plays?: {
        clock?: { displayValue?: string };
        team?: { abbreviation?: string };
        participants?: { athlete?: { displayName?: string } }[];
        scoringPlay?: boolean;
        text?: string;
      }[];
    };
    return (d.plays ?? [])
      .filter((p) => p.scoringPlay)
      .map((p) => {
        const elapsed = Number((p.clock?.displayValue ?? "0").split(":")[0]);
        const type = /penalty/i.test(p.text ?? "")
          ? "penalty"
          : /own/i.test(p.text ?? "")
            ? "ownGoal"
            : "goal";
        return {
          elapsed: isNaN(elapsed) ? null : elapsed,
          teamAbbr: p.team?.abbreviation ?? "",
          player: p.participants?.[0]?.athlete?.displayName ?? "—",
          type,
        };
      });
  } catch {
    return [];
  }
}

// ── Merge ESPN sobre datos estáticos ────────────────────────────────────────

/**
 * Superpone los resultados de ESPN sobre el calendario estático WC 2026.
 * Devuelve los partidos estáticos con scores y status reales cuando existen.
 */
export function mergeEspnIntoStatic(
  staticFixtures: StaticFixture[],
  espnFixtures: LiveFixture[],
): MergedFixture[] {
  // Índice: "homeStaticId:awayStaticId" → LiveFixture
  const byTeams = new Map<string, LiveFixture>();
  for (const ef of espnFixtures) {
    const hId = ef.home.staticId;
    const aId = ef.away.staticId;
    if (hId && aId) byTeams.set(`${hId}:${aId}`, ef);
    // también intentar por nombre (por si falla el mapeo de ID)
    const hName = ef.home.name.toLowerCase();
    const aName = ef.away.name.toLowerCase();
    byTeams.set(`name:${hName}:${aName}`, ef);
  }

  return staticFixtures.map((sf) => {
    let live: LiveFixture | undefined;
    if (sf.homeId && sf.awayId) {
      live =
        byTeams.get(`${sf.homeId}:${sf.awayId}`) ??
        byTeams.get(
          `name:${(TEAM_BY_ID_MAP.get(sf.homeId)?.nameEn ?? "").toLowerCase()}:${(TEAM_BY_ID_MAP.get(sf.awayId)?.nameEn ?? "").toLowerCase()}`,
        );
    }
    return {
      ...sf,
      espnId: live?.espnId ?? null,
      statusShort: (live?.statusShort ?? "pre") as "pre" | "in" | "post",
      statusLabel: live?.statusLabel ?? "Programado",
      elapsed: live?.elapsed ?? null,
      homeScore: live?.home.score ?? null,
      awayScore: live?.away.score ?? null,
      homeWinner: live?.home.winner ?? false,
      awayWinner: live?.away.winner ?? false,
    };
  });
}

const TEAM_BY_ID_MAP = new Map<string, StaticTeam>(
  WC2026_TEAMS.map((t) => [t.id, t]),
);

export interface MergedFixture extends StaticFixture {
  espnId: string | null;
  statusShort: "pre" | "in" | "post";
  statusLabel: string;
  elapsed: number | null;
  homeScore: number | null;
  awayScore: number | null;
  homeWinner: boolean;
  awayWinner: boolean;
}

// ── Tipo Scorer (goleadores del torneo) ─────────────────────────────────────
// ESPN no expone un endpoint público de top-scorers; este tipo lo usan
// la UI y los datos que provienen de fuentes externas.
export interface Scorer {
  rank: number;
  player: string;
  photo: string | null;
  teamName: string;
  teamLogo: string | null;
  goals: number;
  assists: number | null;
}

// ── Calcular clasificaciones desde resultados ────────────────────────────────

export interface StandingRow {
  group: string;
  teamId: string;
  pts: number;
  pj: number;
  pg: number;
  pe: number;
  pp: number;
  gf: number;
  gc: number;
}

/** Calcula la clasificación de todos los grupos a partir de los partidos jugados. */
export function getStandingsFromResults(
  fixtures: MergedFixture[],
): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  for (const t of WC2026_TEAMS) {
    rows.set(t.id, {
      group: t.group,
      teamId: t.id,
      pts: 0, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0,
    });
  }

  for (const f of fixtures) {
    if (f.phase !== "group" || f.statusShort !== "post") continue;
    if (!f.homeId || !f.awayId) continue;
    const hScore = f.homeScore ?? 0;
    const aScore = f.awayScore ?? 0;
    const home = rows.get(f.homeId)!;
    const away = rows.get(f.awayId)!;
    home.pj++; home.gf += hScore; home.gc += aScore;
    away.pj++; away.gf += aScore; away.gc += hScore;
    if (hScore > aScore) { home.pg++; home.pts += 3; away.pp++; }
    else if (hScore < aScore) { away.pg++; away.pts += 3; home.pp++; }
    else { home.pe++; home.pts++; away.pe++; away.pts++; }
  }

  return [...rows.values()].sort(
    (a, b) => b.pts - a.pts || b.gf - b.gc - (a.gf - a.gc),
  );
}
