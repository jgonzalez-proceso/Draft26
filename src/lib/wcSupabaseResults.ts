/**
 * Lee los resultados del Mundial desde la tabla wc_fixtures de Supabase,
 * que es rellenada por el workflow N8N cada minuto.
 * Si la tabla está vacía o no existe, devuelve [] (la página usa ESPN directo).
 */
import { createClient } from "@/lib/supabase/server";
import type { MergedFixture, GoalEvent } from "@/lib/espnFootball";
import { getStaticFixtures } from "@/lib/wc2026Data";

interface WcFixtureRow {
  espn_id: string;
  match_date: string;
  round: string;
  home_name: string;
  home_logo: string;
  home_score: number | null;
  away_name: string;
  away_logo: string;
  away_score: number | null;
  status_short: string;
  elapsed: number | null;
}

interface WcEventRow {
  elapsed: number | null;
  team_abbr: string;
  player_name: string;
  event_type: string;
}

/** True si la tabla wc_fixtures ya tiene datos del pipeline N8N. */
export async function wcN8nHasData(): Promise<boolean> {
  try {
    const supabase = createClient();
    const { count } = await supabase
      .from("wc_fixtures")
      .select("espn_id", { count: "exact", head: true });
    return (count ?? 0) > 0;
  } catch {
    return false;
  }
}

/** Devuelve los fixtures desde Supabase fusionados con el calendario estático. */
export async function getWcResultsFromDb(): Promise<MergedFixture[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("wc_fixtures")
      .select("*")
      .order("match_date", { ascending: true });
    if (error || !data) return [];

    // Índice por nombre (lower) para fusionar con el calendario estático
    const byTeams = new Map<string, WcFixtureRow>();
    for (const row of data as WcFixtureRow[]) {
      byTeams.set(
        `${row.home_name.toLowerCase()}:${row.away_name.toLowerCase()}`,
        row,
      );
    }

    return getStaticFixtures().map((sf) => {
      if (!sf.homeId || !sf.awayId) {
        // slot de eliminatoria: buscar en Supabase por espn_id (no disponible en sf)
        return buildEmpty(sf);
      }
      const hName = nameFromId(sf.homeId);
      const aName = nameFromId(sf.awayId);
      const row = byTeams.get(`${hName}:${aName}`);
      if (!row) return buildEmpty(sf);
      return {
        ...sf,
        espnId: row.espn_id,
        statusShort: (row.status_short ?? "pre") as "pre" | "in" | "post",
        statusLabel: labelFor(row.status_short),
        elapsed: row.elapsed,
        homeScore: row.home_score,
        awayScore: row.away_score,
        homeWinner: (row.home_score ?? 0) > (row.away_score ?? 0),
        awayWinner: (row.away_score ?? 0) > (row.home_score ?? 0),
      };
    });
  } catch {
    return [];
  }
}

/** Devuelve los goles de un partido desde Supabase. */
export async function getWcEventsFromDb(espnId: string): Promise<GoalEvent[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("wc_events")
      .select("elapsed,team_abbr,player_name,event_type")
      .eq("espn_fixture_id", espnId)
      .order("elapsed", { ascending: true });
    if (error || !data) return [];
    return (data as WcEventRow[]).map((e) => ({
      elapsed: e.elapsed,
      teamAbbr: e.team_abbr,
      player: e.player_name,
      type: e.event_type,
    }));
  } catch {
    return [];
  }
}

// ── helpers ─────────────────────────────────────────────────────────────────
import { WC2026_TEAMS } from "@/lib/wc2026Data";
const TEAM_BY_ID_LOCAL = new Map(WC2026_TEAMS.map((t) => [t.id, t]));

function nameFromId(id: string): string {
  return (TEAM_BY_ID_LOCAL.get(id)?.nameEn ?? "").toLowerCase();
}

function buildEmpty(sf: import("@/lib/wc2026Data").StaticFixture): MergedFixture {
  return {
    ...sf,
    espnId: null,
    statusShort: "pre",
    statusLabel: "Programado",
    elapsed: null,
    homeScore: null,
    awayScore: null,
    homeWinner: false,
    awayWinner: false,
  };
}

function labelFor(status: string): string {
  if (status === "in") return "En juego";
  if (status === "post") return "Finalizado";
  return "Programado";
}
