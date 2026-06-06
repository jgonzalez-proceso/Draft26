"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownUp, Timer } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { normalizeName } from "@/lib/wc2026Teams";
import { POSITION_COLORS, POSITION_LABELS, type Position } from "@/types/domain";

export interface HistorialPick {
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

export interface AvailablePlayer {
  id: string;
  full_name: string;
  primary_position: Position;
  team_name: string;
  team_flag: string | null;
}

export default function HistorialTable({
  picks,
  isAdmin,
  availablePlayers,
}: {
  picks: HistorialPick[];
  isAdmin: boolean;
  availablePlayers: AvailablePlayer[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reversed, setReversed] = useState(false);

  const orderedPicks = reversed ? [...picks].reverse() : picks;

  const matches = useMemo(() => {
    const q = normalizeName(query);
    const base = q
      ? availablePlayers.filter(
          (p) => normalizeName(p.full_name).includes(q) || normalizeName(p.team_name).includes(q)
        )
      : availablePlayers;
    return base.slice(0, 60);
  }, [query, availablePlayers]);

  function openEditor(pickId: string) {
    setEditing(pickId);
    setQuery("");
    setError(null);
  }

  async function correct(pickId: string, newPlayerId: string) {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("admin_correct_pick", {
      p_pick_id: pickId,
      p_new_player_id: newPlayerId,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setEditing(null);
    router.refresh();
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <h3 className="font-bold">Historial de picks</h3>
          <p className="text-xs text-muted">{picks.length} elecciones</p>
        </div>
        <button
          onClick={() => setReversed((r) => !r)}
          className="btn-ghost flex items-center gap-1.5 px-2 py-1.5 text-xs"
          title={reversed ? "Ver del primero al último" : "Ver del último al primero"}
        >
          <ArrowDownUp className="h-3.5 w-3.5" />
          {reversed ? "Más antiguos" : "Más recientes"}
        </button>
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
              {isAdmin && <th className="px-4 py-2 text-right">Acción</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {orderedPicks.map((p) => {
              const fecha = new Date(p.created_at).toLocaleString("es-ES", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              });
              const totalCols = isAdmin ? 7 : 6;
              return (
                <Fragment key={p.id}>
                  <tr className={p.is_autoskip ? "text-muted" : ""}>
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
                    {isAdmin && (
                      <td className="px-4 py-2 text-right">
                        {p.is_autoskip ? (
                          <span className="text-xs text-muted">—</span>
                        ) : (
                          <button
                            className="btn-ghost px-2 py-1 text-xs"
                            onClick={() => (editing === p.id ? setEditing(null) : openEditor(p.id))}
                          >
                            {editing === p.id ? "Cancelar" : "Editar"}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>

                  {isAdmin && editing === p.id && (
                    <tr>
                      <td colSpan={totalCols} className="bg-surface-2 px-4 py-3">
                        <p className="mb-2 text-xs text-muted">
                          Cambiar el jugador de este pick (#{p.pick_number}). Solo aparecen
                          jugadores aún libres.
                        </p>
                        <input
                          className="input mb-2 w-full max-w-md"
                          placeholder="Buscar jugador o selección…"
                          value={query}
                          autoFocus
                          onChange={(e) => setQuery(e.target.value)}
                        />
                        {error && (
                          <p className="mb-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">
                            {error}
                          </p>
                        )}
                        <div className="max-h-64 overflow-y-auto rounded-lg border border-line">
                          {matches.length === 0 ? (
                            <p className="px-3 py-3 text-xs text-muted">Sin coincidencias.</p>
                          ) : (
                            <ul className="divide-y divide-line">
                              {matches.map((pl) => (
                                <li key={pl.id}>
                                  <button
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface disabled:opacity-50"
                                    disabled={busy}
                                    onClick={() => correct(p.id, pl.id)}
                                  >
                                    <span
                                      className={`badge ${POSITION_COLORS[pl.primary_position]}`}
                                    >
                                      {POSITION_LABELS[pl.primary_position]}
                                    </span>
                                    <span className="font-medium">{pl.full_name}</span>
                                    <span className="ml-auto flex items-center gap-1.5 text-xs text-muted">
                                      {pl.team_flag && (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                          src={pl.team_flag}
                                          alt=""
                                          className="h-3 w-4 rounded-sm object-cover"
                                        />
                                      )}
                                      {pl.team_name}
                                    </span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
