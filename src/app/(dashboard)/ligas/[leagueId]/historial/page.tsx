import { redirect } from "next/navigation";
import { getLeagueContext } from "@/lib/leagues";
import { createClient } from "@/lib/supabase/server";
import { Timer } from "lucide-react";
import { POSITION_COLORS, POSITION_LABELS, type Position } from "@/types/domain";

interface PickRow {
  id: string;
  pick_number: number;
  created_at: string;
  is_autoskip: boolean;
  profiles: { display_name: string | null } | null;
  players: {
    full_name: string;
    primary_position: Position;
    national_teams: { name: string; flag_url: string | null } | null;
  } | null;
}

export default async function HistorialPage({
  params,
}: {
  params: { leagueId: string };
}) {
  const ctx = await getLeagueContext(params.leagueId);
  if (!ctx) redirect("/ligas");

  const supabase = createClient();
  const { data } = await supabase
    .from("draft_picks")
    .select(
      "id, pick_number, created_at, is_autoskip, profiles(display_name), players(full_name, primary_position, national_teams(name, flag_url))"
    )
    .eq("league_id", params.leagueId)
    .order("pick_number", { ascending: true });

  const picks = (data ?? []) as unknown as PickRow[];

  if (picks.length === 0) {
    return (
      <div className="card p-8 text-center text-muted">
        Aún no se ha realizado ningún pick en esta liga.
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-line px-4 py-3">
        <h3 className="font-bold">Historial de picks</h3>
        <p className="text-xs text-muted">{picks.length} elecciones</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">Participante</th>
              <th className="px-4 py-2">Jugador</th>
              <th className="px-4 py-2">Selección</th>
              <th className="px-4 py-2">Pos.</th>
              <th className="px-4 py-2 text-right">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {picks.map((p) => {
              const fecha = new Date(p.created_at).toLocaleString("es-ES", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <tr key={p.id} className={p.is_autoskip ? "text-muted" : ""}>
                  <td className="px-4 py-2 font-mono text-xs">{p.pick_number}</td>
                  <td className="px-4 py-2 font-medium">{p.profiles?.display_name ?? "—"}</td>
                  {p.is_autoskip ? (
                    <td className="px-4 py-2 text-orange-300" colSpan={3}>
                      <span className="inline-flex items-center gap-1.5">
                        <Timer className="h-3.5 w-3.5" /> turno saltado por tiempo
                      </span>
                    </td>
                  ) : (
                    <>
                      <td className="px-4 py-2">{p.players?.full_name ?? "—"}</td>
                      <td className="px-4 py-2">
                        <span className="flex items-center gap-2">
                          {p.players?.national_teams?.flag_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.players.national_teams.flag_url}
                              alt=""
                              className="h-3.5 w-5 rounded-sm object-cover"
                            />
                          )}
                          {p.players?.national_teams?.name ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        {p.players && (
                          <span className={`badge ${POSITION_COLORS[p.players.primary_position]}`}>
                            {POSITION_LABELS[p.players.primary_position]}
                          </span>
                        )}
                      </td>
                    </>
                  )}
                  <td className="px-4 py-2 text-right text-xs text-muted">{fecha}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
