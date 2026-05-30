"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { POSITIONS, type PlayerWithTeam, type Position } from "@/types/domain";

const GROUP_LABELS: Record<Position, string> = {
  GK: "PORTEROS",
  DEF: "DEFENSAS",
  MID: "MEDIOS",
  FWD: "DELANTEROS",
};

// Plantilla de una selección con estética PC Fútbol: cabecera azul con escudo
// (bandera), filas agrupadas por posición y bandera junto a cada jugador.
export default function SquadTable({
  teamName,
  teamFlag,
  teamGroup,
  players,
  pickedIds,
  canPick,
  onPick,
  onBack,
}: {
  teamName: string;
  teamFlag: string | null;
  teamGroup: string | null;
  players: PlayerWithTeam[];
  pickedIds: Set<string>;
  canPick: boolean;
  onPick?: (playerId: string) => Promise<void>;
  onBack: () => void;
}) {
  const [picking, setPicking] = useState<string | null>(null);

  async function pick(id: string) {
    if (!onPick) return;
    setPicking(id);
    try {
      await onPick(id);
    } finally {
      setPicking(null);
    }
  }

  const available = players.filter((p) => !pickedIds.has(p.id) && p.is_available).length;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-100 text-slate-900 shadow-xl">
      {/* Cabecera azul estilo PC Fútbol */}
      <div className="flex items-center gap-3 bg-gradient-to-b from-blue-700 to-blue-900 px-4 py-3 text-white">
        <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-md border-2 border-yellow-400 bg-white/10 shadow">
          {teamFlag ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={teamFlag} alt={teamName} className="h-full w-full object-cover" />
          ) : (
            <span className="text-lg">🏳️</span>
          )}
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-extrabold uppercase tracking-wide">{teamName}</h2>
          <p className="text-xs text-blue-200">
            {teamGroup ? `Grupo ${teamGroup} · ` : ""}
            {players.length} convocados · {available} libres
          </p>
        </div>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 rounded-md bg-yellow-400 px-3 py-1.5 text-sm font-bold text-blue-950 transition-colors hover:bg-yellow-300"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>
      </div>

      {/* Tabla por posiciones */}
      <div className="divide-y divide-slate-300">
        {POSITIONS.map((pos) => {
          const group = players.filter((p) => p.primary_position === pos);
          if (group.length === 0) return null;
          return (
            <div key={pos}>
              <div className="bg-slate-300/80 px-4 py-1 text-xs font-bold uppercase tracking-wider text-slate-700">
                {GROUP_LABELS[pos]}
              </div>
              <ul>
                {group.map((p, i) => {
                  const taken = pickedIds.has(p.id) || !p.is_available;
                  return (
                    <li
                      key={p.id}
                      className={`flex items-center gap-3 px-4 py-2 ${
                        i % 2 ? "bg-slate-50" : "bg-white"
                      } ${taken ? "opacity-50" : ""}`}
                    >
                      {teamFlag ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={teamFlag}
                          alt=""
                          className="h-3.5 w-5 shrink-0 rounded-sm object-cover ring-1 ring-slate-300"
                        />
                      ) : (
                        <span className="w-5 shrink-0 text-center text-xs">🏳️</span>
                      )}
                      <span className={`flex-1 truncate font-semibold ${taken ? "line-through" : ""}`}>
                        {p.full_name}
                      </span>
                      <span className="hidden truncate text-xs text-slate-500 sm:block">
                        {p.club ?? ""}
                      </span>
                      <div className="w-24 text-right">
                        {canPick && onPick ? (
                          <button
                            disabled={taken || picking !== null}
                            onClick={() => pick(p.id)}
                            className="rounded-md bg-green-600 px-3 py-1 text-xs font-bold text-white hover:bg-green-500 disabled:opacity-40"
                          >
                            {picking === p.id ? "…" : "Elegir"}
                          </button>
                        ) : taken ? (
                          <span className="text-xs font-semibold text-slate-400">Elegido</span>
                        ) : (
                          <span className="text-xs font-semibold text-green-700">Libre</span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
