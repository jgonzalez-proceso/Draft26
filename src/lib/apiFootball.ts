/**
 * Capa de datos de API-Football (api-sports.io) para la pantalla de Resultados.
 *
 * Toda llamada se hace EN EL SERVIDOR con la clave en `API_FOOTBALL_KEY` (nunca
 * `NEXT_PUBLIC_`). El plan Free solo da las temporadas 2022-2024, así que el
 * Mundial 2026 (`season=2026`) requiere plan de pago; mientras tanto se usa la
 * temporada configurada en `API_FOOTBALL_SEASON` (por defecto 2022 = Catar) para
 * mostrar datos reales con la misma interfaz.
 */

const BASE = "https://v3.football.api-sports.io";
const KEY = process.env.API_FOOTBALL_KEY ?? "";

export const WC_LEAGUE = Number(process.env.API_FOOTBALL_LEAGUE ?? 1);
export const WC_SEASON = Number(process.env.API_FOOTBALL_SEASON ?? 2026);

// ── Tipos normalizados que consume la UI ────────────────────────────────────
export interface TeamRef {
  id: number;
  name: string;
  logo: string;
  winner: boolean | null;
}

export interface StandingRow {
  rank: number;
  team: { id: number; name: string; logo: string };
  points: number;
  goalsDiff: number;
  group: string;
  form: string | null;
  played: number;
  win: number;
  draw: number;
  lose: number;
  gf: number;
  ga: number;
}

export interface GroupStanding {
  name: string; // "Group A"
  rows: StandingRow[];
}

export interface Fixture {
  id: number;
  date: string;
  round: string;
  statusShort: string; // NS, 1H, HT, 2H, ET, P, FT, AET, PEN, PST...
  statusLong: string;
  elapsed: number | null;
  home: TeamRef;
  away: TeamRef;
  goalsHome: number | null;
  goalsAway: number | null;
  penHome: number | null;
  penAway: number | null;
}

export interface GoalEvent {
  elapsed: number | null;
  extra: number | null;
  teamId: number;
  player: string;
  assist: string | null;
  detail: string; // "Normal Goal", "Penalty", "Own Goal"...
}

export interface Scorer {
  rank: number;
  player: string;
  photo: string | null;
  teamName: string;
  teamLogo: string | null;
  goals: number;
  assists: number | null;
}

export interface ApiPayload<T> {
  data: T;
  planError: string | null;
}

// ── Helpers de bajo nivel ───────────────────────────────────────────────────
interface RawResponse {
  response: unknown[];
  errors: unknown;
}

function planErrorOf(errors: unknown): string | null {
  if (errors && !Array.isArray(errors) && typeof errors === "object") {
    const e = errors as Record<string, string>;
    return e.plan ?? e.requests ?? e.token ?? e.config ?? null;
  }
  return null;
}

async function apiGet(path: string, revalidate: number): Promise<RawResponse> {
  if (!KEY) return { response: [], errors: { config: "Falta API_FOOTBALL_KEY" } };
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { "x-apisports-key": KEY },
      next: { revalidate },
    });
    if (!res.ok) return { response: [], errors: { http: String(res.status) } };
    const json = (await res.json()) as RawResponse;
    return { response: json.response ?? [], errors: json.errors ?? [] };
  } catch {
    return { response: [], errors: { network: "No se pudo contactar con la API" } };
  }
}

const q = (extra: string) => `league=${WC_LEAGUE}&season=${WC_SEASON}&${extra}`;

// ── Endpoints normalizados ──────────────────────────────────────────────────
export async function getStandings(): Promise<ApiPayload<GroupStanding[]>> {
  const { response, errors } = await apiGet(
    `/standings?league=${WC_LEAGUE}&season=${WC_SEASON}`,
    300,
  );
  const groups: GroupStanding[] = [];
  const first = response[0] as
    | { league?: { standings?: RawStandingRow[][] } }
    | undefined;
  for (const grp of first?.league?.standings ?? []) {
    if (!grp?.length) continue;
    groups.push({
      name: grp[0].group,
      rows: grp.map(normalizeStanding),
    });
  }
  return { data: groups, planError: planErrorOf(errors) };
}

export async function getFixtures(): Promise<ApiPayload<Fixture[]>> {
  const { response, errors } = await apiGet(
    `/fixtures?league=${WC_LEAGUE}&season=${WC_SEASON}`,
    300,
  );
  const data = (response as RawFixture[]).map(normalizeFixture).sort(byKickoff);
  return { data, planError: planErrorOf(errors) };
}

export async function getTopScorers(): Promise<ApiPayload<Scorer[]>> {
  const { response, errors } = await apiGet(`/players/topscorers?${q("")}`, 600);
  const data: Scorer[] = (response as RawScorer[]).map((p, i) => {
    const stat = p.statistics?.[0];
    return {
      rank: i + 1,
      player: p.player?.name ?? "—",
      photo: p.player?.photo ?? null,
      teamName: stat?.team?.name ?? "",
      teamLogo: stat?.team?.logo ?? null,
      goals: stat?.goals?.total ?? 0,
      assists: stat?.goals?.assists ?? null,
    };
  });
  return { data, planError: planErrorOf(errors) };
}

/** Partidos en vivo de la competición (para el proxy /api/wc/live). */
export async function getLiveFixtures(): Promise<ApiPayload<Fixture[]>> {
  const { response, errors } = await apiGet(
    `/fixtures?league=${WC_LEAGUE}&season=${WC_SEASON}&live=all`,
    0,
  );
  return {
    data: (response as RawFixture[]).map(normalizeFixture).sort(byKickoff),
    planError: planErrorOf(errors),
  };
}

/** Goleadores/eventos de un partido (para expandir un MatchRow). */
export async function getFixtureEvents(
  fixtureId: number,
): Promise<ApiPayload<GoalEvent[]>> {
  const { response, errors } = await apiGet(
    `/fixtures/events?fixture=${fixtureId}`,
    30,
  );
  const goals = (response as RawEvent[])
    .filter((e) => e.type === "Goal")
    .map((e) => ({
      elapsed: e.time?.elapsed ?? null,
      extra: e.time?.extra ?? null,
      teamId: e.team?.id ?? 0,
      player: e.player?.name ?? "—",
      assist: e.assist?.name ?? null,
      detail: e.detail ?? "Goal",
    }));
  return { data: goals, planError: planErrorOf(errors) };
}

// ── Clasificación y orden de fases ──────────────────────────────────────────
export function isKnockout(round: string): boolean {
  return !/^group/i.test(round);
}

export function groupStageRound(round: string): number | null {
  const m = round.match(/(\d+)\s*$/);
  return m ? Number(m[1]) : null;
}

/** Orden y etiqueta ES de las rondas de eliminatoria (incluye R32 del Mundial 2026). */
export const KNOCKOUT_ORDER = [
  "Round of 32",
  "Round of 16",
  "Quarter-finals",
  "Semi-finals",
  "3rd Place Final",
  "Final",
] as const;

export const KNOCKOUT_LABEL: Record<string, string> = {
  "Round of 32": "Dieciseisavos",
  "Round of 16": "Octavos",
  "Quarter-finals": "Cuartos",
  "Semi-finals": "Semifinales",
  "3rd Place Final": "3.º y 4.º puesto",
  Final: "Final",
};

// ── Normalizadores (tipos crudos de la API) ─────────────────────────────────
interface RawStandingRow {
  rank: number;
  team: { id: number; name: string; logo: string };
  points: number;
  goalsDiff: number;
  group: string;
  form: string | null;
  all: { played: number; win: number; draw: number; lose: number; goals: { for: number; against: number } };
}
interface RawFixture {
  fixture: { id: number; date: string; status: { short: string; long: string; elapsed: number | null } };
  league: { round: string };
  teams: { home: RawTeam; away: RawTeam };
  goals: { home: number | null; away: number | null };
  score?: { penalty?: { home: number | null; away: number | null } };
}
interface RawTeam { id: number; name: string; logo: string; winner: boolean | null }
interface RawEvent {
  time?: { elapsed: number | null; extra: number | null };
  team?: { id: number };
  player?: { name: string };
  assist?: { name: string | null };
  type?: string;
  detail?: string;
}
interface RawScorer {
  player?: { name: string; photo: string };
  statistics?: { team?: { name: string; logo: string }; goals?: { total: number; assists: number | null } }[];
}

function normalizeStanding(r: RawStandingRow): StandingRow {
  return {
    rank: r.rank,
    team: r.team,
    points: r.points,
    goalsDiff: r.goalsDiff,
    group: r.group,
    form: r.form,
    played: r.all?.played ?? 0,
    win: r.all?.win ?? 0,
    draw: r.all?.draw ?? 0,
    lose: r.all?.lose ?? 0,
    gf: r.all?.goals?.for ?? 0,
    ga: r.all?.goals?.against ?? 0,
  };
}

function normalizeFixture(f: RawFixture): Fixture {
  return {
    id: f.fixture.id,
    date: f.fixture.date,
    round: f.league.round,
    statusShort: f.fixture.status.short,
    statusLong: f.fixture.status.long,
    elapsed: f.fixture.status.elapsed,
    home: f.teams.home,
    away: f.teams.away,
    goalsHome: f.goals.home,
    goalsAway: f.goals.away,
    penHome: f.score?.penalty?.home ?? null,
    penAway: f.score?.penalty?.away ?? null,
  };
}

function byKickoff(a: Fixture, b: Fixture): number {
  return a.date.localeCompare(b.date);
}

const LIVE_STATUSES = new Set(["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT"]);
export function isLive(statusShort: string): boolean {
  return LIVE_STATUSES.has(statusShort);
}
export function isFinished(statusShort: string): boolean {
  return ["FT", "AET", "PEN"].includes(statusShort);
}
