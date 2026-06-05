"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { normalizeName } from "@/lib/wc2026Teams";
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
  const [selPos, setSelPos] = useState<Set<Position>>(new Set());
  const [selTeams, setSelTeams] = useState<Set<string>>(new Set());
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [picking, setPicking] = useState<string | null>(null);

  // Desplegable de selecciones (multi)
  const [teamsOpen, setTeamsOpen] = useState(false);
  const [teamQuery, setTeamQuery] = useState("");
  const teamsRef = useRef<HTMLDivElement>(null);

  // Cerrar el panel de selecciones al hacer clic fuera
  useEffect(() => {
    if (!teamsOpen) return;
    function onDocClick(e: MouseEvent) {
      if (teamsRef.current && !teamsRef.current.contains(e.target as Node)) {
        setTeamsOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [teamsOpen]);

  const teamName = useMemo(() => new Map(teams.map((t) => [t.id, t.name])), [teams]);

  const teamMatches = useMemo(() => {
    const q = normalizeName(teamQuery);
    return q ? teams.filter((t) => normalizeName(t.name).includes(q)) : teams;
  }, [teams, teamQuery]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return players.filter((p) => {
      const taken = pickedIds.has(p.id) || !p.is_available;
      if (onlyAvailable && taken) return false;
      if (selPos.size && !selPos.has(p.primary_position)) return false;
      if (selTeams.size && !selTeams.has(p.national_team_id)) return false;
      if (q && !p.full_name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [players, pickedIds, onlyAvailable, selPos, selTeams, search]);

  function togglePos(p: Position) {
    setSelPos((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  function toggleTeam(id: string) {
    setSelTeams((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
        <div className="flex flex-wrap items-center gap-2">
          {/* Selecciones (multi) */}
          <div className="relative" ref={teamsRef}>
            <button
              type="button"
              onClick={() => setTeamsOpen((v) => !v)}
              className="btn flex items-center gap-2 border border-line bg-surface-2 px-3 py-1.5 text-sm"
              aria-expanded={teamsOpen}
            >
              {selTeams.size ? `Selecciones · ${selTeams.size}` : "Todas las selecciones"}
              <ChevronDown className="h-4 w-4" />
            </button>

            {teamsOpen && (
              <div className="absolute left-0 z-20 mt-1 w-72 max-w-[80vw] rounded-lg border border-line bg-surface p-2 shadow-xl">
                <input
                  className="input mb-2"
                  placeholder="Buscar selección…"
                  value={teamQuery}
                  autoFocus
                  onChange={(e) => setTeamQuery(e.target.value)}
                />
                <div className="mb-2 flex items-center justify-between px-1 text-xs text-muted">
                  <span>{selTeams.size} seleccionadas</span>
                  {selTeams.size > 0 && (
                    <button
                      type="button"
                      className="text-gold-300 hover:underline"
                      onClick={() => setSelTeams(new Set())}
                    >
                      Limpiar
                    </button>
                  )}
                </div>
                <ul className="max-h-60 space-y-0.5 overflow-y-auto">
                  {teamMatches.map((t) => (
                    <li key={t.id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-surface-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-pitch-500"
                          checked={selTeams.has(t.id)}
                          onChange={() => toggleTeam(t.id)}
                        />
                        <span className="truncate">{t.name}</span>
                      </label>
                    </li>
                  ))}
                  {teamMatches.length === 0 && (
                    <li className="px-2 py-2 text-xs text-muted">Sin coincidencias.</li>
                  )}
                </ul>
              </div>
            )}
          </div>

          {/* Posiciones (multi) */}
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setSelPos(new Set())}
              className={`btn px-3 py-1.5 text-xs ${
                selPos.size === 0 ? "bg-pitch-500 text-white" : "border border-line bg-surface-2"
              }`}
            >
              Todas
            </button>
            {POSITIONS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => togglePos(p)}
                className={`btn px-3 py-1.5 text-xs ${
                  selPos.has(p) ? "bg-pitch-500 text-white" : "border border-line bg-surface-2"
                }`}
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

        {/* Chips de selecciones elegidas */}
        {selTeams.size > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {[...selTeams].map((id) => (
              <span
                key={id}
                className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 px-2 py-0.5 text-xs"
              >
                {teamName.get(id) ?? "—"}
                <button
                  type="button"
                  aria-label={`Quitar ${teamName.get(id) ?? ""}`}
                  onClick={() => toggleTeam(id)}
                  className="text-muted hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <p className="mb-2 text-sm text-muted">{filtered.length} jugadores</p>

      <ul className="max-h-[60vh] space-y-1.5 overflow-auto pr-1">
        {filtered.map((p) => {
          const taken = pickedIds.has(p.id) || !p.is_available;
          return (
            <li
              key={p.id}
              className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 ${
                taken ? "border-line bg-surface-2/50 opacity-60" : "border-line bg-surface-2"
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className={`badge ${POSITION_COLORS[p.primary_position]} text-sm`}>
                  {p.primary_position}
                </span>
                <div className="min-w-0">
                  <p className={`truncate text-base font-semibold sm:text-lg ${taken ? "line-through" : ""}`}>
                    {p.full_name}
                  </p>
                  <p className="truncate text-sm text-muted">
                    {p.team_name}
                    {p.club ? ` · ${p.club}` : ""}
                  </p>
                </div>
              </div>
              {canPick && onPick ? (
                <button
                  className="btn-gold shrink-0 px-4 py-2 text-sm"
                  disabled={taken || picking !== null}
                  onClick={() => handlePick(p.id)}
                >
                  {picking === p.id ? "…" : "Elegir"}
                </button>
              ) : taken ? (
                <span className="badge shrink-0 bg-slate-500/15 text-sm text-slate-300">Elegido</span>
              ) : (
                <span className="badge shrink-0 bg-pitch-500/15 text-sm text-pitch-300">Libre</span>
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
