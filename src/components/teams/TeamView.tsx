"use client";

import { useMemo, useState } from "react";
import { Lock } from "lucide-react";
import { useDraftRealtime, type DraftRealtimeState } from "@/hooks/useDraftRealtime";
import Pitch from "@/components/teams/Pitch";
import { FORMATIONS, DEFAULT_FORMATION, assignSquad } from "@/lib/formations";
import { POSITION_COLORS, POSITIONS, type PlayerWithTeam } from "@/types/domain";

interface Member {
  user_id: string;
  display_name: string;
}

export default function TeamView({
  leagueId,
  members,
  players,
  initial,
  initialUserId,
  isAdmin,
}: {
  leagueId: string;
  members: Member[];
  players: PlayerWithTeam[];
  initial: DraftRealtimeState;
  initialUserId: string;
  isAdmin: boolean;
}) {
  const { teams } = useDraftRealtime(leagueId, initial);
  const [userId, setUserId] = useState(initialUserId);

  // Cada equipo tiene su propia formación guardada en un Map.
  // Así cambiar la tuya no afecta a lo que se muestra en los equipos ajenos.
  const [formations, setFormations] = useState<Map<string, string>>(
    () => new Map([[initialUserId, DEFAULT_FORMATION]]),
  );

  // Puede editar el equipo actualmente visible:
  // — siempre el propio, — admin puede editar todos.
  const canEdit = userId === initialUserId || isAdmin;

  const currentFormation = formations.get(userId) ?? DEFAULT_FORMATION;

  function changeFormation(f: string) {
    if (!canEdit) return;
    setFormations((prev) => new Map(prev).set(userId, f));
  }

  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const squad = useMemo(
    () =>
      teams
        .filter((t) => t.user_id === userId)
        .map((t) => playerById.get(t.player_id))
        .filter((p): p is PlayerWithTeam => !!p),
    [teams, userId, playerById],
  );

  const { lineup, bench } = useMemo(
    () => assignSquad(squad, currentFormation),
    [squad, currentFormation],
  );

  const countByPos = (pos: string) => squad.filter((p) => p.primary_position === pos).length;

  const viewedMember = members.find((m) => m.user_id === userId);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_18rem]">
      {/* Campo */}
      <div className="space-y-3">
        {/* Selector de participante */}
        <div className="flex flex-wrap gap-1.5">
          {members.map((m) => (
            <button
              key={m.user_id}
              onClick={() => setUserId(m.user_id)}
              className={`btn px-3 py-1.5 text-sm ${
                m.user_id === userId
                  ? "bg-pitch-500 text-white"
                  : "border border-line bg-surface-2 text-foreground"
              }`}
            >
              {m.display_name}
            </button>
          ))}
        </div>

        <Pitch lineup={lineup} />
      </div>

      {/* Menú lateral estilo PES */}
      <div className="space-y-4">
        {/* Táctica */}
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">Táctica</h3>
            {!canEdit && (
              <span className="flex items-center gap-1 text-xs text-muted">
                <Lock className="h-3 w-3" />
                Solo lectura
              </span>
            )}
          </div>

          {canEdit ? (
            <>
              <p className="mt-1 text-xs text-muted">
                {userId === initialUserId
                  ? "Cambia la formación de tu equipo."
                  : `Editando equipo de ${viewedMember?.display_name ?? "participante"} (admin).`}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {Object.keys(FORMATIONS).map((f) => (
                  <button
                    key={f}
                    onClick={() => changeFormation(f)}
                    className={`btn px-2 py-1.5 text-sm ${
                      f === currentFormation
                        ? "bg-gold-500 text-slate-900"
                        : "border border-line bg-surface-2"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-2 text-xs text-muted">
              Estás viendo el equipo de{" "}
              <span className="font-semibold text-foreground">
                {viewedMember?.display_name ?? "otro participante"}
              </span>
              . Solo el administrador o el propio jugador pueden modificarlo.
            </p>
          )}
        </div>

        {/* Plantilla */}
        <div className="card p-4">
          <h3 className="font-bold">Plantilla</h3>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {POSITIONS.map((pos) => (
              <span key={pos} className={`badge ${POSITION_COLORS[pos]}`}>
                {pos} {countByPos(pos)}
              </span>
            ))}
            <span className="badge bg-surface-2 text-muted">Total {squad.length}</span>
          </div>
        </div>

        {/* Banquillo */}
        <div className="card p-4">
          <h3 className="font-bold">Banquillo</h3>
          {bench.length === 0 ? (
            <p className="mt-2 text-xs text-muted">Sin suplentes para esta formación.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {bench.map((p) => (
                <li key={p.id} className="flex items-center gap-2 text-sm">
                  {p.team_flag && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.team_flag}
                      alt=""
                      className="h-3.5 w-5 rounded-sm object-cover"
                    />
                  )}
                  <span className={`badge ${POSITION_COLORS[p.primary_position]}`}>
                    {p.primary_position}
                  </span>
                  <span className="truncate">{p.full_name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
