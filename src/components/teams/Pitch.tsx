"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { POSITION_COLORS, type Position, type PlayerWithTeam } from "@/types/domain";
import type { PlacedSlot } from "@/lib/formations";

// Campo de fútbol (horizontal) con los jugadores colocados según la formación.
// Si `editable`, cada hueco es zona de soltar y cada ficha se puede arrastrar.
export default function Pitch({
  lineup,
  editable = false,
}: {
  lineup: PlacedSlot[];
  editable?: boolean;
}) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-xl border border-pitch-800 shadow-inner"
      style={{
        aspectRatio: "3 / 2",
        backgroundImage: "url('/pitch.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 bg-black/10" />
      {lineup.map(({ slot, player }, i) => (
        <SlotDrop key={i} index={i} pos={slot.pos} x={slot.x} y={slot.y} player={player} editable={editable} />
      ))}
    </div>
  );
}

function SlotDrop({
  index,
  pos,
  x,
  y,
  player,
  editable,
}: {
  index: number;
  pos: Position;
  x: number;
  y: number;
  player: PlayerWithTeam | null;
  editable: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot:${index}`, disabled: !editable });
  return (
    <div
      ref={setNodeRef}
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      {player ? (
        <Chip player={player} fromSlot={index} editable={editable} />
      ) : (
        <div className="flex flex-col items-center gap-1">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-full border-2 border-dashed bg-black/30 ${
              isOver ? "scale-110 border-gold-400" : "border-white/60"
            }`}
          >
            <span className={`badge ${POSITION_COLORS[pos]} px-1`}>{pos}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Ficha de jugador arrastrable (en el campo o en el banquillo).
export function Chip({
  player,
  fromSlot,
  editable,
}: {
  player: PlayerWithTeam;
  fromSlot: number | null;
  editable: boolean;
}) {
  const { setNodeRef, listeners, attributes, transform, isDragging } = useDraggable({
    id: `chip:${player.id}`,
    data: { playerId: player.id, fromSlot },
    disabled: !editable,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`flex flex-col items-center gap-1 ${editable ? "cursor-grab touch-none" : ""} ${
        isDragging ? "opacity-80" : ""
      }`}
    >
      <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-surface shadow-md">
        {player.team_flag ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={player.team_flag} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className={`badge ${POSITION_COLORS[player.primary_position]} px-1`}>
            {player.primary_position}
          </span>
        )}
      </div>
      <span className="max-w-[5.5rem] truncate rounded bg-black/65 px-1.5 py-0.5 text-center text-[10px] font-semibold leading-tight text-white">
        {lastName(player.full_name)}
      </span>
    </div>
  );
}

function lastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : name;
}
