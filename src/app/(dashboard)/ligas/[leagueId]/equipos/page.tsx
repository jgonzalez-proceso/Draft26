import { redirect } from "next/navigation";
import { getLeagueContext } from "@/lib/leagues";
import { createClient } from "@/lib/supabase/server";
import TeamView from "@/components/teams/TeamView";
import type { DraftPick, PlayerWithTeam, UserTeamEntry } from "@/types/domain";

export default async function EquiposPage({
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
  const [{ data: rawPlayers }, { data: userTeams }, { data: picks }] = await Promise.all([
    supabase.from("players").select("*, national_teams(name, flag_url)").order("full_name"),
    supabase.from("user_teams").select("*").eq("league_id", params.leagueId),
    supabase.from("draft_picks").select("*").eq("league_id", params.leagueId).order("pick_number"),
  ]);

  const players: PlayerWithTeam[] = (rawPlayers ?? []).map((p) => {
    const nt = (p as { national_teams: { name: string; flag_url: string | null } | null }).national_teams;
    return { ...(p as PlayerWithTeam), team_name: nt?.name ?? "—", team_flag: nt?.flag_url ?? null, team_group: null };
  });

  const members = ctx.members.map((m) => ({
    user_id: m.user_id,
    display_name: m.profiles?.display_name ?? "Participante",
  }));

  return (
    <TeamView
      leagueId={params.leagueId}
      members={members}
      players={players}
      initialUserId={ctx.userId}
      isAdmin={ctx.isAdmin}
      initial={{
        draft: ctx.draft,
        picks: (picks ?? []) as DraftPick[],
        teams: (userTeams ?? []) as UserTeamEntry[],
      }}
    />
  );
}
