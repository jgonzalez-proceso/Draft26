"use client";

import { useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
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
  teamSlug,
  players,
  pickedIds,
  canPick,
  onPick,
  onBack,
}: {
  teamName: string;
  teamFlag: string | null;
  teamGroup: string | null;
  teamSlug: string;
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
          <h2 className="font-display text-2xl tracking-[0.08em]">{teamName}</h2>
          <p className="text-xs text-blue-200">
            {teamGroup ? `Grupo ${teamGroup} · ` : ""}
            {players.length > 0
              ? `${players.length} convocados · ${available} libres`
              : "Pendiente de cargar plantilla"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={`https://www.jornadaperfecta.com/mundial/equipo/${teamSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Alineación probable de ${teamName} (abre en jornadaperfecta.com)`}
            className="inline-flex min-h-[40px] items-center gap-1 rounded-md bg-blue-950/40 px-3 py-1.5 text-sm font-semibold text-yellow-300 ring-1 ring-yellow-400/50 transition-colors hover:bg-blue-950/70"
          >
            <ExternalLink className="h-4 w-4" /> Alineación probable
          </a>
          <button
            onClick={onBack}
            className="inline-flex min-h-[40px] items-center gap-1 rounded-md bg-yellow-400 px-3 py-1.5 text-sm font-bold text-blue-950 transition-colors hover:bg-yellow-300"
          >
            <ArrowLeft className="h-4 w-4" /> Volver
          </button>
        </div>
      </div>

      {/* Tabla por posiciones */}
      {players.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="font-semibold text-slate-700">Pendiente de cargar plantilla</p>
          <p className="mt-1 text-sm text-slate-500">
            Este equipo aún no tiene jugadores cargados. Consulta la alineación probable.
          </p>
        </div>
      ) : (
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
      )}
    </div>
  );
}
