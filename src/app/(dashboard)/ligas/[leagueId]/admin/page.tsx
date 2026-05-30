import { redirect } from "next/navigation";
import { getLeagueContext } from "@/lib/leagues";
import { createClient } from "@/lib/supabase/server";
import DraftControls from "@/components/admin/DraftControls";
import LeagueSettingsForm from "@/components/admin/LeagueSettingsForm";
import DraftConfigForm from "@/components/admin/DraftConfigForm";
import CsvImporter from "@/components/admin/CsvImporter";

export default async function AdminPage({
  params,
}: {
  params: { leagueId: string };
}) {
  const ctx = await getLeagueContext(params.leagueId);
  if (!ctx) redirect("/ligas");
  if (!ctx.isAdmin) redirect(`/ligas/${params.leagueId}`);

  const { league, draft, members } = ctx;
  const drawn = members.some((m) => m.draft_order != null);

  // ¿Hay picks ya hechos? (para mostrar "Reiniciar")
  const supabase = createClient();
  const { count: pickCount } = await supabase
    .from("draft_picks")
    .select("id", { count: "exact", head: true })
    .eq("league_id", league.id);

  const lockedConfig =
    league.status === "draft_active" ||
    league.status === "draft_paused" ||
    league.status === "draft_finished";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="lg:col-span-2">
        <DraftControls
          leagueId={league.id}
          status={league.status}
          drawn={drawn}
          membersCount={members.length}
          hasPicks={(pickCount ?? 0) > 0}
        />
      </div>

      <LeagueSettingsForm
        leagueId={league.id}
        initialName={league.name}
        initialMax={league.max_participants}
        membersCount={members.length}
      />

      {draft && (
        <DraftConfigForm
          leagueId={league.id}
          initialMode={draft.draft_mode}
          initialTimerEnabled={draft.timer_enabled}
          initialTurnSeconds={draft.turn_seconds}
          initialPicksPerUser={draft.picks_per_user}
          locked={lockedConfig}
        />
      )}

      <div className="lg:col-span-2">
        <CsvImporter />
      </div>
    </div>
  );
}
