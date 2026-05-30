import { redirect } from "next/navigation";
import { getLeagueContext } from "@/lib/leagues";
import { createClient } from "@/lib/supabase/server";
import SquadExplorer from "@/components/players/SquadExplorer";
import type { DraftPick, PlayerWithTeam, UserTeamEntry } from "@/types/domain";

export default async function JugadoresPage({
  params,
}: {
  params: { leagueId: string };
}) {
  const ctx = await getLeagueContext(params.leagueId);
  if (!ctx) redirect("/ligas");
  if (!ctx.draft) {
    return <div className="card p-8 text-center text-muted">Liga sin draft configurado.</div>;
  }

  const supabase = createClient();
  const [{ data: rawPlayers }, { data: rawTeams }, { data: picks }, { data: userTeams }] =
    await Promise.all([
      supabase
        .from("players")
        .select("*, national_teams(name, flag_url)")
        .order("full_name", { ascending: true }),
      supabase.from("national_teams").select("id, name, flag_url, grp:group").order("name"),
      supabase.from("draft_picks").select("*").eq("league_id", params.leagueId).order("pick_number"),
      supabase.from("user_teams").select("*").eq("league_id", params.leagueId),
    ]);

  const players: PlayerWithTeam[] = (rawPlayers ?? []).map((p) => {
    const nt = (p as { national_teams: { name: string; flag_url: string | null } | null }).national_teams;
    return {
      ...(p as PlayerWithTeam),
      team_name: nt?.name ?? "—",
      team_flag: nt?.flag_url ?? null,
      team_group: null,
    };
  });

  const teams = (rawTeams ?? []).map((t) => {
    const row = t as { id: string; name: string; flag_url: string | null; grp: string | null };
    return { id: row.id, name: row.name, flag_url: row.flag_url, group: row.grp };
  });

  return (
    <SquadExplorer
      leagueId={params.leagueId}
      userId={ctx.userId}
      teams={teams}
      players={players}
      initial={{
        draft: ctx.draft,
        picks: (picks ?? []) as DraftPick[],
        teams: (userTeams ?? []) as UserTeamEntry[],
      }}
    />
  );
}
