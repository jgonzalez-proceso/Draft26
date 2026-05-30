import {
  getStaticGroups,
  getStaticFixtures,
  WC2026_TEAMS,
} from "@/lib/wc2026Data";
import {
  getEspnScoreboard,
  mergeEspnIntoStatic,
  getStandingsFromResults,
  type StandingRow,
  type MergedFixture,
  type Scorer,
} from "@/lib/espnFootball";
import { wcN8nHasData, getWcResultsFromDb } from "@/lib/wcSupabaseResults";
import ResultadosShell from "@/components/resultados/ResultadosShell";

export const metadata = { title: "Resultados · Copa del Mundo 2026" };

// Cero stats inicial para pre-torneo
function emptyStandingRows(group: string): StandingRow[] {
  return WC2026_TEAMS.filter((t) => t.group === group).map((t) => ({
    group: t.group,
    teamId: t.id,
    pts: 0, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0,
  }));
}

export default async function ResultadosPage() {
  const staticGroups = getStaticGroups();    // 12 grupos con 4 equipos c/u
  const staticFixtures = getStaticFixtures(); // 104 partidos estáticos

  // ── Resultados: N8N → Supabase (si está activo) o ESPN directo ──────────
  let mergedFixtures: MergedFixture[];
  let dataSource: "espn" | "n8n" | "static";

  if (await wcN8nHasData()) {
    mergedFixtures = await getWcResultsFromDb();
    dataSource = "n8n";
  } else {
    // ESPN devuelve sólo los partidos del día; el resto queda en "pre"
    const espnToday = await getEspnScoreboard();
    mergedFixtures = mergeEspnIntoStatic(staticFixtures, espnToday);
    dataSource = espnToday.length > 0 ? "espn" : "static";
  }

  // ── Clasificaciones calculadas desde resultados ─────────────────────────
  const standingRows = getStandingsFromResults(mergedFixtures);
  const rowsByGroup = new Map<string, StandingRow[]>();
  for (const r of standingRows) {
    (rowsByGroup.get(r.group) ?? rowsByGroup.set(r.group, []).get(r.group)!).push(r);
  }

  // ── Armar datos para cada grupo ─────────────────────────────────────────
  const groups = staticGroups.map((g) => ({
    name: g.name.replace(/^Grupo\s+/i, ""), // "A" … "L"
    standings: rowsByGroup.get(g.name.replace(/^Grupo\s+/i, "")) ?? emptyStandingRows(g.name.replace(/^Grupo\s+/i, "")),
    fixtures: mergedFixtures.filter(
      (f) => f.phase === "group" && f.round.includes(` ${g.name.replace(/^Grupo\s+/i, "")}`),
    ),
  }));

  // Goleadores: pre-torneo no hay (ESPN no tiene topscorers sin autenticación)
  const scorers: Scorer[] = [];

  return (
    <ResultadosShell
      groups={groups}
      allFixtures={mergedFixtures}
      scorers={scorers}
      dataSource={dataSource}
    />
  );
}
