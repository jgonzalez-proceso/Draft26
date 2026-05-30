import { getLeagueContext } from "@/lib/leagues";
import LeagueMenu from "@/components/leagues/LeagueMenu";

export default async function LeagueResumenPage({
  params,
}: {
  params: { leagueId: string };
}) {
  const ctx = await getLeagueContext(params.leagueId);
  if (!ctx) return null;

  const { league, members, isAdmin } = ctx;

  return (
    <LeagueMenu
      leagueId={league.id}
      name={league.name}
      status={league.status}
      inviteCode={league.invite_code}
      worldCupYear={league.world_cup_year}
      maxParticipants={league.max_participants}
      isAdmin={isAdmin}
      members={members.map((m) => ({
        display_name: m.profiles?.display_name ?? "Participante",
        role: m.role,
        draft_order: m.draft_order,
      }))}
    />
  );
}
