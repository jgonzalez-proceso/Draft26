"use client";

import { useState } from "react";
import { GripVertical, X } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { POSITION_COLORS, type PlayerWithTeam } from "@/types/domain";

interface WatchlistPanelProps {
  watchlist: string[];
  playerById: Map<string, PlayerWithTeam>;
  pickedIds: Set<string>;
  isMyTurn: boolean;
  onRemove: (id: string) => void;
  onPick: (id: string) => Promise<void>;
  onReorder: (newOrder: string[]) => void;
}

export default function WatchlistPanel({
  watchlist,
  playerById,
  pickedIds,
  isMyTurn,
  onRemove,
  onPick,
  onReorder,
}: WatchlistPanelProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = watchlist.indexOf(String(active.id));
    const newIndex = watchlist.indexOf(String(over.id));
    if (oldIndex !== -1 && newIndex !== -1) {
      onReorder(arrayMove(watchlist, oldIndex, newIndex));
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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={watchlist} strategy={verticalListSortingStrategy}>
            <ul className="space-y-1.5">
              {watchlist.map((id) => {
                const p = playerById.get(id);
                if (!p) return null;
                const taken = pickedIds.has(id);
                return (
                  <SortableItem
                    key={id}
                    id={id}
                    player={p}
                    taken={taken}
                    isMyTurn={isMyTurn}
                    onRemove={onRemove}
                    onPick={onPick}
                  />
                );
              })}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function SortableItem({
  id,
  player,
  taken,
  isMyTurn,
  onRemove,
  onPick,
}: {
  id: string;
  player: PlayerWithTeam;
  taken: boolean;
  isMyTurn: boolean;
  onRemove: (id: string) => void;
  onPick: (id: string) => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const [picking, setPicking] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  async function handlePick() {
    setPicking(true);
    try { await onPick(id); } finally { setPicking(false); }
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-lg border px-2 py-2 text-sm ${
        isDragging
          ? "z-50 border-gold-500 bg-surface opacity-90 shadow-lg"
          : taken
          ? "border-line bg-surface-2/50 opacity-60"
          : "border-line bg-surface-2"
      }`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab touch-none text-muted active:cursor-grabbing"
        aria-label="Reordenar"
        tabIndex={-1}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <span className={`badge shrink-0 ${POSITION_COLORS[player.primary_position]}`}>
        {player.primary_position}
      </span>

      <div className="min-w-0 flex-1">
        <p className={`truncate font-medium leading-tight ${taken ? "line-through" : ""}`}>
          {player.full_name}
        </p>
        <p className="truncate text-xs text-muted">{player.team_name}</p>
      </div>

      {taken ? (
        <div className="flex shrink-0 items-center gap-1">
          <span className="badge bg-slate-500/15 text-xs text-slate-300">Cogido</span>
          <button aria-label="Quitar" onClick={() => onRemove(id)} className="text-muted hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-1">
          {isMyTurn && (
            <button
              className="btn-gold px-3 py-1 text-xs"
              disabled={picking}
              onClick={handlePick}
            >
              {picking ? "…" : "Elegir"}
            </button>
          )}
          <button aria-label="Quitar" onClick={() => onRemove(id)} className="text-muted hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </li>
  );
}
