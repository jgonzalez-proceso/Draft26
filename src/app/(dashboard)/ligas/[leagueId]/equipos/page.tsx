import { redirect } from "next/navigation";
import { getLeagueContext } from "@/lib/leagues";
import { createClient } from "@/lib/supabase/server";
import TeamView from "@/components/teams/TeamView";
import { fetchAllPlayers } from "@/lib/players";
import type { DraftPick, PlayerWithTeam, UserLineup, UserTeamEntry } from "@/types/domain";

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
  const [rawPlayers, { data: userTeams }, { data: picks }, { data: lineups }] = await Promise.all([
    fetchAllPlayers(supabase),
    supabase.from("user_teams").select("*").eq("league_id", params.leagueId),
    supabase.from("draft_picks").select("*").eq("league_id", params.leagueId).order("pick_number"),
    supabase.from("user_lineups").select("user_id, formation, slots").eq("league_id", params.leagueId),
  ]);

  const initialLineups: UserLineup[] = ((lineups ?? []) as { user_id: string; formation: string; slots: unknown }[]).map(
    (l) => ({
      league_id: params.leagueId,
      user_id: l.user_id,
      formation: l.formation,
      slots: (Array.isArray(l.slots) ? l.slots : []) as (string | null)[],
    }),
  );

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
      initialLineups={initialLineups}
      initial={{
        draft: ctx.draft,
        picks: (picks ?? []) as DraftPick[],
        teams: (userTeams ?? []) as UserTeamEntry[],
      }}
    />
  );
}
