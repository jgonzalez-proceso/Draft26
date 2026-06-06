"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { POSITION_COLORS, type PlayerWithTeam } from "@/types/domain";

interface WatchlistPanelProps {
  watchlist: string[];
  playerById: Map<string, PlayerWithTeam>;
  pickedIds: Set<string>;
  isMyTurn: boolean;
  onRemove: (id: string) => void;
  onPick: (id: string) => Promise<void>;
}

export default function WatchlistPanel({
  watchlist,
  playerById,
  pickedIds,
  isMyTurn,
  onRemove,
  onPick,
}: WatchlistPanelProps) {
  const [picking, setPicking] = useState<string | null>(null);

  async function handlePick(id: string) {
    setPicking(id);
    try {
      await onPick(id);
    } finally {
      setPicking(null);
    }
  }

  const available = watchlist.filter((id) => !pickedIds.has(id)).length;

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-bold">Mi preselección</h3>
        {watchlist.length > 0 && (
          <span className="rounded-full bg-gold-500/15 px-2 py-0.5 text-xs font-semibold text-gold-300">
            {available}/{watchlist.length}
          </span>
        )}
      </div>

      {watchlist.length === 0 ? (
        <p className="text-xs text-muted">
          Añade jugadores con el marcador ★ para guardarlos aquí.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {watchlist.map((id) => {
            const p = playerById.get(id);
            if (!p) return null;
            const taken = pickedIds.has(id);
            return (
              <li
                key={id}
                className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-sm ${
                  taken
                    ? "border-line bg-surface-2/50 opacity-60"
                    : "border-line bg-surface-2"
                }`}
              >
                <span className={`badge shrink-0 ${POSITION_COLORS[p.primary_position]}`}>
                  {p.primary_position}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`truncate font-medium ${taken ? "line-through" : ""}`}>
                    {p.full_name}
                  </p>
                  <p className="truncate text-xs text-muted">{p.team_name}</p>
                </div>
                {taken ? (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="badge bg-slate-500/15 text-xs text-slate-300">Cogido</span>
                    <button
                      aria-label="Quitar"
                      onClick={() => onRemove(id)}
                      className="text-muted hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex shrink-0 items-center gap-1.5">
                    {isMyTurn && (
                      <button
                        className="btn-gold px-3 py-1 text-xs"
                        disabled={picking !== null}
                        onClick={() => handlePick(id)}
                      >
                        {picking === id ? "…" : "Elegir"}
                      </button>
                    )}
                    <button
                      aria-label="Quitar"
                      onClick={() => onRemove(id)}
                      className="text-muted hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
