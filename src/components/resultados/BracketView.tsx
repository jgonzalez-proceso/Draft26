"use client";

import { useMemo } from "react";
import { getBracket, TEAM_BY_ID } from "@/lib/wc2026Data";
import type { MergedFixture } from "@/lib/espnFootball";

// Orden vertical de cada columna para que el árbol cuadre con los cruces oficiales.
const LEFT = {
  r32: ["M74", "M77", "M73", "M75", "M83", "M84", "M81", "M82"],
  r16: ["M89", "M90", "M93", "M94"],
  qf: ["M97", "M98"],
  sf: ["M101"],
};
const RIGHT = {
  r32: ["M76", "M78", "M79", "M80", "M86", "M88", "M85", "M87"],
  r16: ["M91", "M92", "M95", "M96"],
  qf: ["M99", "M100"],
  sf: ["M102"],
};

const ROUND_TITLE: Record<string, string> = {
  r32: "Dieciseisavos",
  r16: "Octavos",
  qf: "Cuartos",
  sf: "Semifinal",
};

const dateFmt = new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short" });

export default function BracketView({ fixtures }: { fixtures: MergedFixture[] }) {
  const bracket = useMemo(() => getBracket(), []);
  const defByCode = useMemo(
    () => new Map(bracket.map((m) => [m.code, m])),
    [bracket],
  );
  // Resultados reales (si ESPN los rellena) indexados por matchCode
  const fxByCode = useMemo(() => {
    const m = new Map<string, MergedFixture>();
    for (const f of fixtures) if (f.matchCode) m.set(f.matchCode, f);
    return m;
  }, [fixtures]);

  function Slot({
    label,
    teamId,
    score,
    winner,
  }: {
    label: string;
    teamId: string | null;
    score: number | null;
    winner: boolean;
  }) {
    const team = teamId ? TEAM_BY_ID.get(teamId) : null;
    return (
      <div className="flex items-center gap-1.5 px-1.5 py-1">
        {team ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={team.flagUrl} alt="" className="h-3 w-[18px] shrink-0 rounded-sm object-cover ring-1 ring-black/40" />
            <span className={`min-w-0 flex-1 truncate ${winner ? "font-bold text-white" : "text-blue-100/90"}`}>
              {team.nameEs}
            </span>
          </>
        ) : (
          <span className="min-w-0 flex-1 truncate italic text-blue-300/70">{label}</span>
        )}
        {score != null && (
          <span className="shrink-0 font-mono font-bold tabular-nums text-amber-300">{score}</span>
        )}
      </div>
    );
  }

  function Match({ code, highlight }: { code: string; highlight?: boolean }) {
    const d = defByCode.get(code);
    if (!d) return null;
    const fx = fxByCode.get(code);
    const played = !!fx && (fx.statusShort === "post" || fx.statusShort === "in");
    return (
      <div
        className={`overflow-hidden rounded-md text-[11px] shadow ${
          highlight
            ? "w-[clamp(160px,16cqi,200px)] border-2 border-amber-400/70 bg-[#0e1a33] ring-2 ring-amber-400/20"
            : "w-[clamp(150px,15cqi,190px)] border border-blue-900/70 bg-[#0e1a33]"
        }`}
        aria-label={`${d.code}: ${d.home} contra ${d.away}`}
      >
        <div
          className={`flex items-center justify-between px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
            highlight ? "bg-amber-900/40 text-amber-200" : "bg-blue-950/60 text-blue-300/70"
          }`}
        >
          <span>{d.code}</span>
          <span>{dateFmt.format(new Date(d.date))}</span>
        </div>
        <Slot label={d.home} teamId={fx?.homeId ?? null} score={played ? fx?.homeScore ?? null : null} winner={!!fx?.homeWinner} />
        <div className="border-t border-blue-950/70" />
        <Slot label={d.away} teamId={fx?.awayId ?? null} score={played ? fx?.awayScore ?? null : null} winner={!!fx?.awayWinner} />
      </div>
    );
  }

  function Column({ codes, title }: { codes: string[]; title?: string }) {
    return (
      <div className="flex h-[46rem] shrink-0 flex-col">
        {title && (
          <h3 className="mb-1 rounded bg-gradient-to-b from-blue-700 to-blue-900 px-2 py-0.5 text-center text-[10px] font-extrabold uppercase tracking-wider text-white">
            {title}
          </h3>
        )}
        <div className="flex flex-1 flex-col justify-around">
          {codes.map((c) => (
            <Match key={c} code={c} />
          ))}
        </div>
      </div>
    );
  }

  // Conectores tipo corchete: count elbows de altura fija, centrados con justify-around.
  function Elbows({ count, h, side, title }: { count: number; h: string; side: "l" | "r"; title?: boolean }) {
    return (
      <div className="flex h-[46rem] w-3 shrink-0 flex-col">
        {title && <div className="mb-1 h-[1.1rem]" />}
        <div className="flex flex-1 flex-col justify-around">
          {Array.from({ length: count }).map((_, i) => (
            <div
              key={i}
              style={{ height: h }}
              className={`${side === "l" ? "border-y-2 border-r-2" : "border-y-2 border-l-2"} border-slate-500/30`}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-3">
      <div className="flex min-w-max items-stretch justify-center gap-0">
        {/* ── Vía izquierda ── */}
        <Column codes={LEFT.r32} title={ROUND_TITLE.r32} />
        <Elbows count={4} h="5.4rem" side="l" title />
        <Column codes={LEFT.r16} title={ROUND_TITLE.r16} />
        <Elbows count={2} h="11rem" side="l" title />
        <Column codes={LEFT.qf} title={ROUND_TITLE.qf} />
        <Elbows count={1} h="22rem" side="l" title />
        <Column codes={LEFT.sf} title={ROUND_TITLE.sf} />

        {/* ── Centro: Final + 3.º puesto ── */}
        <div className="flex h-[46rem] shrink-0 flex-col items-center justify-center gap-4 px-2">
          <div className="flex flex-col items-center">
            <span className="mb-1.5 text-base font-black uppercase tracking-[0.2em] text-amber-300">
              Final
            </span>
            <Match code="M104" highlight />
          </div>
          <Match code="M103" />
        </div>

        {/* ── Vía derecha (espejo) ── */}
        <Column codes={RIGHT.sf} title={ROUND_TITLE.sf} />
        <Elbows count={1} h="22rem" side="r" title />
        <Column codes={RIGHT.qf} title={ROUND_TITLE.qf} />
        <Elbows count={2} h="11rem" side="r" title />
        <Column codes={RIGHT.r16} title={ROUND_TITLE.r16} />
        <Elbows count={4} h="5.4rem" side="r" title />
        <Column codes={RIGHT.r32} title={ROUND_TITLE.r32} />
      </div>
    </div>
  );
}
