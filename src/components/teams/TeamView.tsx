"use client";

import { useMemo, useState } from "react";
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
}: {
  leagueId: string;
  members: Member[];
  players: PlayerWithTeam[];
  initial: DraftRealtimeState;
  initialUserId: string;
}) {
  const { teams } = useDraftRealtime(leagueId, initial);
  const [userId, setUserId] = useState(initialUserId);
  const [formation, setFormation] = useState(DEFAULT_FORMATION);

  const isOwnTeam = userId === initialUserId;

  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const squad = useMemo(() => {
    return teams
      .filter((t) => t.user_id === userId)
      .map((t) => playerById.get(t.player_id))
      .filter((p): p is PlayerWithTeam => !!p);
  }, [teams, userId, playerById]);

  const { lineup, bench } = useMemo(() => assignSquad(squad, formation), [squad, formation]);

  const countByPos = (pos: string) => squad.filter((p) => p.primary_position === pos).length;

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
                m.user_id === userId ? "bg-pitch-500 text-white" : "border border-line bg-surface-2 text-foreground"
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
        <div className="card p-4">
          <h3 className="font-bold">Táctica</h3>
          {isOwnTeam ? (
            <>
              <p className="mt-1 text-xs text-muted">Cambia la formación de tu equipo.</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {Object.keys(FORMATIONS).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFormation(f)}
                    className={`btn px-2 py-1.5 text-sm ${
                      f === formation ? "bg-gold-500 text-slate-900" : "border border-line bg-surface-2"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-1 text-xs text-muted">
              Solo puedes configurar tu propio equipo.
            </p>
          )}
        </div>

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
                    <img src={p.team_flag} alt="" className="h-3.5 w-5 rounded-sm object-cover" />
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
