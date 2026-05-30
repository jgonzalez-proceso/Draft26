import { POSITION_COLORS } from "@/types/domain";
import type { PlacedSlot } from "@/lib/formations";

// Campo de fútbol (horizontal) con los jugadores colocados según la formación.
export default function Pitch({ lineup }: { lineup: PlacedSlot[] }) {
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
        <div
          key={i}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
        >
          <div className="flex flex-col items-center gap-1">
            <div
              className={`flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 shadow-md ${
                player ? "border-white bg-surface" : "border-dashed border-white/60 bg-black/30"
              }`}
            >
              {player?.team_flag ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={player.team_flag} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className={`badge ${POSITION_COLORS[slot.pos]} px-1`}>{slot.pos}</span>
              )}
            </div>
            {player && (
              <span className="max-w-[5.5rem] truncate rounded bg-black/65 px-1.5 py-0.5 text-center text-[10px] font-semibold leading-tight text-white">
                {lastName(player.full_name)}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function lastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : name;
}
