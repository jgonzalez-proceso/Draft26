import type { StandingRow } from "@/lib/espnFootball";
import { WC2026_TEAMS } from "@/lib/wc2026Data";

const TEAM_MAP = new Map(WC2026_TEAMS.map((t) => [t.id, t]));

const COLS: { k: keyof StandingRow; abbr: string; title: string }[] = [
  { k: "pj", abbr: "PJ", title: "Partidos jugados" },
  { k: "pg", abbr: "PG", title: "Ganados" },
  { k: "pe", abbr: "PE", title: "Empatados" },
  { k: "pp", abbr: "PP", title: "Perdidos" },
  { k: "gf", abbr: "GF", title: "Goles a favor" },
  { k: "gc", abbr: "GC", title: "Goles en contra" },
];

export default function StandingsTable({
  groupName,
  rows,
}: {
  groupName: string;
  rows: StandingRow[];
}) {
  return (
    <div className="overflow-hidden rounded-md border border-blue-950/70 bg-[#0c1730]">
      {/* Cabecera del grupo */}
      <div className="flex items-center justify-between bg-gradient-to-b from-blue-700 to-blue-900 px-2 py-1">
        <h3 className="text-[clamp(11px,1.2cqi,15px)] font-extrabold uppercase tracking-wide text-white">
          Grupo {groupName}
        </h3>
        <div className="flex gap-[0.4em] text-[clamp(8px,0.85cqi,11px)] font-bold text-blue-100/90">
          {COLS.map((c) => (
            <span key={c.k} title={c.title} className="w-[1.9em] text-center">
              {c.abbr}
            </span>
          ))}
          <span title="Puntos" className="w-[2.1em] text-center text-amber-300">
            PTS
          </span>
        </div>
      </div>

      {/* Filas */}
      <ul className="divide-y divide-blue-950/60">
        {rows.map((r, i) => {
          const team = TEAM_MAP.get(r.teamId);
          const qualifies = i < 2;
          return (
            <li
              key={r.teamId}
              className={`flex items-center gap-1.5 py-1 pl-1 pr-2 text-[clamp(10px,1.05cqi,14px)] ${
                i % 2 ? "bg-[#11203d]" : "bg-[#0e1a33]"
              }`}
            >
              {/* Barra de clasificado — no solo color */}
              <span
                className={`h-[1.4em] w-[3px] shrink-0 rounded ${qualifies ? "bg-pitch-400" : "bg-transparent"}`}
                aria-hidden
              />
              <span className="w-[1.3em] shrink-0 text-center font-mono tabular-nums text-blue-300/70">
                {i + 1}
              </span>
              {team && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={team.flagUrl}
                  alt=""
                  loading="lazy"
                  className="h-4 w-6 shrink-0 rounded-sm object-cover ring-1 ring-black/40"
                />
              )}
              <span
                className={`min-w-0 flex-1 truncate font-semibold ${qualifies ? "text-white" : "text-blue-100/90"}`}
                title={qualifies ? `${team?.nameEs ?? r.teamId} (clasificado)` : (team?.nameEs ?? r.teamId)}
              >
                {team?.nameEs ?? r.teamId}
              </span>
              <div className="flex shrink-0 gap-[0.4em] font-mono tabular-nums text-blue-200/85">
                {COLS.map((c) => (
                  <span key={c.k} className="w-[1.9em] text-center">
                    {r[c.k]}
                  </span>
                ))}
                <span className="w-[2.1em] text-center font-bold text-amber-300">
                  {r.pts}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
