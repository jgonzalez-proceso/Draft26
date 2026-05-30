"use client";

import { useMemo, useState } from "react";
import {
  POSITIONS,
  POSITION_COLORS,
  type PlayerWithTeam,
  type Position,
} from "@/types/domain";

export default function PlayerPickList({
  players,
  pickedIds,
  canPick = false,
  onPick,
  teams,
}: {
  players: PlayerWithTeam[];
  pickedIds: Set<string>;
  canPick?: boolean;
  onPick?: (playerId: string) => Promise<void>;
  teams: { id: string; name: string }[];
}) {
  const [search, setSearch] = useState("");
  const [pos, setPos] = useState<Position | "ALL">("ALL");
  const [teamId, setTeamId] = useState<string>("ALL");
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [picking, setPicking] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return players.filter((p) => {
      const taken = pickedIds.has(p.id) || !p.is_available;
      if (onlyAvailable && taken) return false;
      if (pos !== "ALL" && p.primary_position !== pos) return false;
      if (teamId !== "ALL" && p.national_team_id !== teamId) return false;
      if (q && !p.full_name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [players, pickedIds, onlyAvailable, pos, teamId, search]);

  async function handlePick(id: string) {
    if (!onPick) return;
    setPicking(id);
    try {
      await onPick(id);
    } finally {
      setPicking(null);
    }
  }

  return (
    <div>
      {/* Filtros */}
      <div className="mb-3 space-y-2">
        <input
          className="input"
          placeholder="Buscar jugador…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <select className="input max-w-[12rem]" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            <option value="ALL">Todas las selecciones</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <div className="flex gap-1">
            <button
              onClick={() => setPos("ALL")}
              className={`btn px-3 py-1.5 text-xs ${pos === "ALL" ? "bg-pitch-500 text-white" : "border border-line bg-surface-2"}`}
            >
              Todas
            </button>
            {POSITIONS.map((p) => (
              <button
                key={p}
                onClick={() => setPos(p)}
                className={`btn px-3 py-1.5 text-xs ${pos === p ? "bg-pitch-500 text-white" : "border border-line bg-surface-2"}`}
              >
                {p}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={onlyAvailable}
              onChange={(e) => setOnlyAvailable(e.target.checked)}
              className="h-4 w-4 accent-pitch-500"
            />
            Solo disponibles
          </label>
        </div>
      </div>

      <p className="mb-2 text-xs text-muted">{filtered.length} jugadores</p>

      <ul className="max-h-[60vh] space-y-1.5 overflow-auto pr-1">
        {filtered.map((p) => {
          const taken = pickedIds.has(p.id) || !p.is_available;
          return (
            <li
              key={p.id}
              className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
                taken ? "border-line bg-surface-2/50 opacity-60" : "border-line bg-surface-2"
              }`}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className={`badge ${POSITION_COLORS[p.primary_position]}`}>
                  {p.primary_position}
                </span>
                <div className="min-w-0">
                  <p className={`truncate font-medium ${taken ? "line-through" : ""}`}>{p.full_name}</p>
                  <p className="truncate text-xs text-muted">
                    {p.team_name}
                    {p.club ? ` · ${p.club}` : ""}
                  </p>
                </div>
              </div>
              {canPick && onPick ? (
                <button
                  className="btn-gold shrink-0 px-3 py-1.5 text-xs"
                  disabled={taken || picking !== null}
                  onClick={() => handlePick(p.id)}
                >
                  {picking === p.id ? "…" : "Elegir"}
                </button>
              ) : taken ? (
                <span className="badge shrink-0 bg-slate-500/15 text-slate-300">Elegido</span>
              ) : (
                <span className="badge shrink-0 bg-pitch-500/15 text-pitch-300">Libre</span>
              )}
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="py-6 text-center text-sm text-muted">Sin resultados con esos filtros.</li>
        )}
      </ul>
    </div>
  );
}
