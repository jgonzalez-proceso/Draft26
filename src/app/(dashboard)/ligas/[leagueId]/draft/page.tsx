import { redirect } from "next/navigation";
import { getLeagueContext } from "@/lib/leagues";
import { createClient } from "@/lib/supabase/server";
import DraftRoom from "@/components/draft/DraftRoom";
import type { DraftPick, PlayerWithTeam, UserTeamEntry } from "@/types/domain";

export default async function DraftPage({
  params,
}: {
  params: { leagueId: string };
}) {
  const ctx = await getLeagueContext(params.leagueId);
  if (!ctx) redirect("/ligas");
  if (!ctx.draft) {
    return (
      <div className="card p-8 text-center text-muted">
        Esta liga aún no tiene un draft configurado.
      </div>
    );
  }

  const supabase = createClient();

  const [{ data: rawPlayers }, { data: teamsList }, { data: picks }, { data: userTeams }] =
    await Promise.all([
      supabase
        .from("players")
        .select("*, national_teams(name, flag_url)")
        .order("full_name", { ascending: true }),
      supabase.from("national_teams").select("id, name").order("name", { ascending: true }),
      supabase
        .from("draft_picks")
        .select("*")
        .eq("league_id", params.leagueId)
        .order("pick_number", { ascending: true }),
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

  const members = ctx.members.map((m) => ({
    user_id: m.user_id,
    display_name: m.profiles?.display_name ?? "Participante",
    draft_order: m.draft_order,
  }));

  return (
    <DraftRoom
      leagueId={params.leagueId}
      userId={ctx.userId}
      members={members}
      players={players}
      teams={(teamsList ?? []) as { id: string; name: string }[]}
      initial={{
        draft: ctx.draft,
        picks: (picks ?? []) as DraftPick[],
        teams: (userTeams ?? []) as UserTeamEntry[],
      }}
    />
  );
}
