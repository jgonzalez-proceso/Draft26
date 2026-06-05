import { redirect } from "next/navigation";
import { getLeagueContext } from "@/lib/leagues";
import { createClient } from "@/lib/supabase/server";
import { fetchAllPlayers } from "@/lib/players";
import HistorialTable, {
  type AvailablePlayer,
  type HistorialPick,
} from "@/components/admin/HistorialTable";
import type { Position } from "@/types/domain";

export default async function HistorialPage({
  params,
}: {
  params: { leagueId: string };
}) {
  const ctx = await getLeagueContext(params.leagueId);
  if (!ctx) redirect("/ligas");

  const supabase = createClient();
  const [{ data: pickData }, { data: userTeams }, rawPlayers] = await Promise.all([
    supabase
      .from("draft_picks")
      .select(
        "id, pick_number, created_at, is_autoskip, profiles(display_name), players(full_name, primary_position, national_teams(name, flag_url))"
      )
      .eq("league_id", params.leagueId)
      .order("pick_number", { ascending: true }),
    supabase.from("user_teams").select("player_id").eq("league_id", params.leagueId),
    // Solo necesitamos el catálogo para que el admin pueda corregir picks.
    ctx.isAdmin ? fetchAllPlayers(supabase) : Promise.resolve([]),
  ]);

  const picks = (pickData ?? []) as unknown as HistorialPick[];

  if (picks.length === 0) {
    return (
      <div className="card p-8 text-center text-muted">
        Aún no se ha realizado ningún pick en esta liga.
      </div>
    );
  }

  // Jugadores aún libres (excluye los ya elegidos en esta liga), para el corrector.
  const pickedIds = new Set((userTeams ?? []).map((u) => (u as { player_id: string }).player_id));
  const availablePlayers: AvailablePlayer[] = ctx.isAdmin
    ? rawPlayers
        .filter((p) => !pickedIds.has(p.id as string))
        .map((p) => {
          const nt = (p as { national_teams: { name: string; flag_url: string | null } | null })
            .national_teams;
          return {
            id: p.id as string,
            full_name: p.full_name as string,
            primary_position: p.primary_position as Position,
            team_name: nt?.name ?? "—",
            team_flag: nt?.flag_url ?? null,
          };
        })
    : [];

  return (
    <HistorialTable picks={picks} isAdmin={ctx.isAdmin} availablePlayers={availablePlayers} />
  );
}
