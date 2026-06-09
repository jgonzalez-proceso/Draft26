import { redirect } from "next/navigation";
import { getLeagueContext } from "@/lib/leagues";
import { createClient } from "@/lib/supabase/server";
import PorraView from "@/components/porra/PorraView";
import type { PorraPrediction, PorraResult } from "@/types/domain";

export default async function PorraPage({
  params,
}: {
  params: { leagueId: string };
}) {
  const ctx = await getLeagueContext(params.leagueId);
  if (!ctx) redirect("/ligas");

  const supabase = createClient();

  const [{ data: predictions }, { data: porraResult }] = await Promise.all([
    supabase
      .from("porra_predictions")
      .select("*")
      .eq("league_id", params.leagueId),
    supabase
      .from("porra_results")
      .select("*")
      .eq("league_id", params.leagueId)
      .maybeSingle(),
  ]);

  const members = ctx.members.map((m) => ({
    user_id: m.user_id,
    display_name: m.profiles?.display_name ?? m.user_id.slice(0, 8),
  }));

  const myPrediction =
    (predictions ?? []).find((p) => p.user_id === ctx.userId) ?? null;

  return (
    <PorraView
      leagueId={ctx.league.id}
      userId={ctx.userId}
      members={members}
      myPrediction={myPrediction as PorraPrediction | null}
      allPredictions={(predictions ?? []) as PorraPrediction[]}
      initialPorraResult={porraResult as PorraResult | null}
      isAdmin={ctx.isAdmin}
    />
  );
}
