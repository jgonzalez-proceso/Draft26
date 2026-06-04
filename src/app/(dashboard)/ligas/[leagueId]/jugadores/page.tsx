import { redirect } from "next/navigation";
import { getLeagueContext } from "@/lib/leagues";
import { createClient } from "@/lib/supabase/server";
import SquadExplorer from "@/components/players/SquadExplorer";
import { fetchAllPlayers } from "@/lib/players";
import { WC2026_TEAMS, normalizeName } from "@/lib/wc2026Teams";
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
  const [rawPlayers, { data: rawTeams }, { data: picks }, { data: userTeams }] =
    await Promise.all([
      fetchAllPlayers(supabase),
      supabase.from("national_teams").select("id, name, flag_url").order("name"),
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

  // Equipos de la BD indexados por nombre normalizado (para fusionar con los 48)
  const dbByName = new Map<
    string,
    { id: string; name: string; flag_url: string | null }
  >();
  for (const t of rawTeams ?? []) {
    const row = t as { id: string; name: string; flag_url: string | null };
    dbByName.set(normalizeName(row.name), row);
  }

  // Lista autoritativa de 48 equipos en sus grupos. Los que existen en la BD
  // conservan su id real (y por tanto su plantilla); el resto van como
  // "pendiente de cargar plantilla".
  const teams = WC2026_TEAMS.map((wt) => {
    const db = dbByName.get(normalizeName(wt.nameEs));
    return {
      id: db?.id ?? wt.id,
      name: wt.nameEs,
      flag_url: db?.flag_url ?? wt.flagUrl,
      group: wt.group,
      pending: !db,
    };
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
