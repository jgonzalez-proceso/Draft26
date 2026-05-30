"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useDraftRealtime, type DraftRealtimeState } from "@/hooks/useDraftRealtime";
import { Hourglass, Flag, Timer } from "lucide-react";
import PickTimer from "@/components/draft/PickTimer";
import PlayerPickList from "@/components/players/PlayerPickList";
import StatusBadge from "@/components/leagues/StatusBadge";
import {
  POSITION_COLORS,
  POSITIONS,
  type PlayerWithTeam,
} from "@/types/domain";

interface Member {
  user_id: string;
  display_name: string;
  draft_order: number | null;
}

export default function DraftRoom({
  leagueId,
  userId,
  members,
  players,
  teams: teamList,
  initial,
}: {
  leagueId: string;
  userId: string;
  members: Member[];
  players: PlayerWithTeam[];
  teams: { id: string; name: string }[];
  initial: DraftRealtimeState;
}) {
  const { draft, picks, teams, refetch } = useDraftRealtime(leagueId, initial);
  const [error, setError] = useState<string | null>(null);

  const playerById = useMemo(
    () => new Map(players.map((p) => [p.id, p])),
    [players]
  );
  const memberById = useMemo(
    () => new Map(members.map((m) => [m.user_id, m])),
    [members]
  );
  const pickedIds = useMemo(() => new Set(teams.map((t) => t.player_id)), [teams]);
  const order = useMemo(
    () => [...members].filter((m) => m.draft_order != null).sort((a, b) => a.draft_order! - b.draft_order!),
    [members]
  );

  const isActive = draft.status === "draft_active";
  const isMyTurn = isActive && draft.current_turn_user_id === userId;
  const turnName = draft.current_turn_user_id
    ? memberById.get(draft.current_turn_user_id)?.display_name ?? "—"
    : "—";

  async function onPick(playerId: string) {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("make_pick", {
      p_draft_id: draft.id,
      p_player_id: playerId,
    });
    if (error) setError(error.message);
    refetch();
  }

  // Equipos por usuario
  const teamsByUser = useMemo(() => {
    const map = new Map<string, PlayerWithTeam[]>();
    for (const m of members) map.set(m.user_id, []);
    for (const t of teams) {
      const p = playerById.get(t.player_id);
      if (p) (map.get(t.user_id) ?? map.set(t.user_id, []).get(t.user_id)!).push(p);
    }
    return map;
  }, [teams, members, playerById]);

  // Pre-draft
  if (draft.status === "pending_players" || draft.status === "pending_draw") {
    return (
      <div className="card p-8 text-center">
        <Hourglass className="mx-auto mb-3 h-9 w-9 text-gold-400" />
        <h2 className="text-lg font-bold">El draft aún no ha empezado</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">
          {order.length > 0
            ? "El orden ya está sorteado. El administrador iniciará el draft pronto."
            : "El administrador sorteará el orden e iniciará el draft."}
        </p>
        {order.length > 0 && (
          <ol className="mx-auto mt-5 max-w-xs space-y-1 text-left">
            {order.map((m) => (
              <li key={m.user_id} className="flex items-center gap-2 text-sm">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold-500/15 text-xs font-bold text-gold-300">
                  {m.draft_order}
                </span>
                {m.display_name}
              </li>
            ))}
          </ol>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Cabecera de estado */}
      <div
        className={`card p-4 ${isMyTurn ? "animate-pulse-turn border-gold-500" : ""} ${
          draft.status === "draft_paused" ? "border-orange-500" : ""
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <StatusBadge status={draft.status} />
              <span className="text-xs text-muted">Pick #{draft.current_pick_number}</span>
              {draft.total_picks && (
                <span className="text-xs text-muted">/ {draft.total_picks}</span>
              )}
            </div>
            <p className="mt-1.5 text-lg">
              {draft.status === "draft_paused" ? (
                <span className="font-bold text-orange-300">Draft pausado por el admin</span>
              ) : draft.status === "draft_finished" ? (
                <span className="inline-flex items-center gap-1.5 font-bold text-indigo-300">
                  <Flag className="h-4 w-4" /> Draft finalizado
                </span>
              ) : isMyTurn ? (
                <span className="font-bold text-gold-300">¡Es tu turno! Elige un jugador</span>
              ) : (
                <>
                  Turno de <span className="font-bold">{turnName}</span>
                </>
              )}
            </p>
          </div>
          {isActive && (
            <PickTimer
              draftId={draft.id}
              deadline={draft.pick_deadline}
              turnSeconds={draft.turn_seconds}
              autoExpire={isMyTurn}
              onExpire={refetch}
            />
          )}
        </div>
        {error && (
          <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Jugadores */}
        <div className="lg:col-span-2">
          <div className="card p-4">
            <h3 className="mb-3 font-bold">Jugadores</h3>
            <PlayerPickList
              players={players}
              pickedIds={pickedIds}
              canPick={isMyTurn}
              onPick={onPick}
              teams={teamList}
            />
          </div>
        </div>

        {/* Lateral: orden + historial */}
        <div className="space-y-5">
          <div className="card p-4">
            <h3 className="mb-3 font-bold">Orden de elección</h3>
            <ol className="space-y-1">
              {order.map((m) => {
                const active = m.user_id === draft.current_turn_user_id && isActive;
                return (
                  <li
                    key={m.user_id}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${
                      active ? "bg-gold-500/10 font-semibold text-gold-300" : ""
                    }`}
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-2 text-xs font-bold">
                      {m.draft_order}
                    </span>
                    {m.display_name}
                    {m.user_id === userId && <span className="text-xs text-muted">(tú)</span>}
                    <span className="ml-auto rounded bg-surface-2 px-1.5 text-xs tabular-nums text-muted">
                      {teamsByUser.get(m.user_id)?.length ?? 0}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="card p-4">
            <h3 className="mb-3 font-bold">Historial</h3>
            <ul className="max-h-72 space-y-1.5 overflow-auto pr-1">
              {[...picks].reverse().map((pick) => {
                const p = pick.player_id ? playerById.get(pick.player_id) : null;
                const name = memberById.get(pick.user_id)?.display_name ?? "—";
                return (
                  <li key={pick.id} className="flex items-center gap-2 text-sm">
                    <span className="font-mono text-xs text-muted">#{pick.pick_number}</span>
                    {pick.is_autoskip ? (
                      <span className="inline-flex items-center gap-1 text-orange-300">
                        <Timer className="h-3.5 w-3.5" /> {name} — turno saltado
                      </span>
                    ) : (
                      <>
                        <span className={`badge ${p ? POSITION_COLORS[p.primary_position] : ""}`}>
                          {p?.primary_position}
                        </span>
                        <span className="truncate">
                          <span className="font-medium">{name}</span> → {p?.full_name}
                        </span>
                      </>
                    )}
                  </li>
                );
              })}
              {picks.length === 0 && (
                <li className="py-4 text-center text-xs text-muted">Aún no hay picks.</li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Equipos (resumen) */}
      <div className="card p-4">
        <h3 className="mb-3 font-bold">Equipos</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m) => {
            const squad = teamsByUser.get(m.user_id) ?? [];
            return (
              <div key={m.user_id} className="rounded-lg border border-line bg-surface-2 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{m.display_name}</span>
                  <span className="text-xs text-muted">{squad.length} jug.</span>
                </div>
                <div className="mt-2 space-y-2">
                  {POSITIONS.map((pos) => {
                    const inPos = squad.filter((p) => p.primary_position === pos);
                    if (inPos.length === 0) return null;
                    return (
                      <div key={pos} className="flex flex-wrap items-center gap-1">
                        <span className={`badge ${POSITION_COLORS[pos]}`}>{pos}</span>
                        {inPos.map((p) => (
                          <span key={p.id} className="text-xs">{p.full_name}</span>
                        ))}
                      </div>
                    );
                  })}
                  {squad.length === 0 && <p className="text-xs text-muted">Sin jugadores aún.</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
