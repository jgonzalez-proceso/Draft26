import type { Scorer } from "@/lib/espnFootball";

export default function ScorersView({ scorers }: { scorers: Scorer[] }) {
  if (scorers.length === 0) {
    return (
      <p className="px-3 py-10 text-center text-sm text-blue-200/70">
        Los goleadores se mostrarán cuando se jueguen los primeros partidos (11 Jun 2026).
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-2xl overflow-hidden rounded-md border border-blue-950/70 bg-[#0c1730]">
      <div className="flex items-center gap-2 bg-gradient-to-b from-blue-700 to-blue-900 px-3 py-1.5 text-[clamp(11px,1.2cqi,15px)] font-extrabold uppercase tracking-wide text-white">
        <span className="w-7 text-center">#</span>
        <span className="flex-1">Jugador</span>
        <span className="w-10 text-center" title="Asistencias">AS</span>
        <span className="w-12 text-center text-amber-300" title="Goles">GOL</span>
      </div>
      <ul className="divide-y divide-blue-950/60">
        {scorers.map((s, i) => (
          <li
            key={`${s.player}-${i}`}
            className={`flex items-center gap-2 px-3 py-1.5 text-[clamp(11px,1.05cqi,14px)] ${
              i % 2 ? "bg-[#11203d]" : "bg-[#0e1a33]"
            }`}
          >
            <span className="w-7 text-center font-mono tabular-nums text-blue-300/70">{s.rank}</span>
            {s.teamLogo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.teamLogo} alt="" loading="lazy"
                className="h-4 w-6 shrink-0 rounded-sm object-cover ring-1 ring-black/40" />
            )}
            <span className="min-w-0 flex-1 truncate font-semibold text-blue-50">
              {s.player}
              <span className="ml-2 hidden text-xs font-normal text-blue-300/60 sm:inline">{s.teamName}</span>
            </span>
            <span className="w-10 text-center font-mono tabular-nums text-blue-200/80">{s.assists ?? 0}</span>
            <span className="w-12 text-center font-mono text-base font-bold tabular-nums text-amber-300">{s.goals}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
