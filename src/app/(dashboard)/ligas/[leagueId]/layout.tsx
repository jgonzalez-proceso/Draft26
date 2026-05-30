import { redirect } from "next/navigation";
import { getLeagueContext } from "@/lib/leagues";
import LeagueNav from "@/components/leagues/LeagueNav";

export default async function LeagueLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { leagueId: string };
}) {
  const ctx = await getLeagueContext(params.leagueId);
  if (!ctx) redirect("/ligas");

  return (
    <div>
      <LeagueNav
        leagueId={ctx.league.id}
        name={ctx.league.name}
        status={ctx.league.status}
        isAdmin={ctx.isAdmin}
      />
      <div className="pt-6">{children}</div>
    </div>
  );
}
