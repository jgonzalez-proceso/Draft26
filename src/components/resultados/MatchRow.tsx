"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import type { MergedFixture, GoalEvent } from "@/lib/espnFootball";
import { WC2026_TEAMS } from "@/lib/wc2026Data";

const TEAM_MAP = new Map(WC2026_TEAMS.map((t) => [t.id, t]));

const dateFmt = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Madrid",
});

function Flag({ src, alt, size = "sm" }: { src: string; alt: string; size?: "sm" | "md" }) {
  const cls = size === "md" ? "h-5 w-7" : "h-4 w-6";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={`${cls} shrink-0 rounded-sm object-cover ring-1 ring-black/40`}
    />
  );
}

export default function MatchRow({
  fx,
  compact = false,
}: {
  fx: MergedFixture;
  compact?: boolean;
}) {
  const isLive = fx.statusShort === "in";
  const isFinished = fx.statusShort === "post";
  const played = isLive || isFinished;

  const homeTeam = fx.homeId ? TEAM_MAP.get(fx.homeId) : null;
  const awayTeam = fx.awayId ? TEAM_MAP.get(fx.awayId) : null;

  const homeName = homeTeam?.nameEs ?? fx.homeId ?? "Por definir";
  const awayName = awayTeam?.nameEs ?? fx.awayId ?? "Por definir";
  const homeFlag = homeTeam?.flagUrl ?? "";
  const awayFlag = awayTeam?.flagUrl ?? "";

  const [open, setOpen] = useState(false);
  const [goals, setGoals] = useState<GoalEvent[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [homeScore, setHomeScore] = useState(fx.homeScore);
  const [awayScore, setAwayScore] = useState(fx.awayScore);
  const [elapsed, setElapsed] = useState(fx.elapsed);

  async function loadGoals() {
    if (!fx.espnId) { setGoals([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/wc/live?fixture=${fx.espnId}`);
      const json = (await res.json()) as { goals?: GoalEvent[] };
      setGoals(json.goals ?? []);
    } catch {
      setGoals([]);
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && goals === null && played) loadGoals();
  }

  // Polling en vivo: cada 45 s, sólo con partidos en juego
  useEffect(() => {
    if (!isLive || !fx.espnId) return;
    async function poll() {
      if (document.hidden) return;
      try {
        const res = await fetch(`/api/wc/live?fixture=${fx.espnId}`);
        const json = (await res.json()) as {
          goals?: GoalEvent[];
          homeScore?: number;
          awayScore?: number;
          elapsed?: number;
        };
        if (json.goals) setGoals(json.goals);
        if (json.homeScore != null) setHomeScore(json.homeScore);
        if (json.awayScore != null) setAwayScore(json.awayScore);
        if (json.elapsed != null) setElapsed(json.elapsed);
      } catch {
        /* reintenta en siguiente tick */
      }
    }
    const timer = setInterval(poll, 45000);
    poll();
    return () => clearInterval(timer);
  }, [isLive, fx.espnId]);

  const score = played ? `${homeScore ?? 0} - ${awayScore ?? 0}` : "vs";

  return (
    <div
      className={`overflow-hidden rounded-md border border-blue-950/60 ${
        compact ? "bg-[#0e1a33]" : "bg-[#0e1a33]/80"
      }`}
    >
      <div className="flex items-stretch text-[clamp(11px,1.05cqi,14px)]">
        <button
          onClick={toggle}
          disabled={!played}
          aria-expanded={open}
          aria-label={`${homeName} ${score} ${awayName}. Ver goleadores`}
          className="group flex flex-1 items-center gap-1.5 px-2 py-1.5 text-left outline-none transition-colors hover:bg-white/5 focus-visible:bg-white/10 disabled:cursor-default"
        >
          {/* Local */}
          <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5 text-right">
            <span className={`truncate font-semibold ${fx.homeWinner ? "text-white" : "text-blue-100/90"}`}>
              {homeName}
            </span>
            {homeFlag && <Flag src={homeFlag} alt={homeName} />}
          </span>

          {/* Marcador */}
          <span className="flex shrink-0 flex-col items-center px-1">
            <span
              className={`min-w-[3em] rounded px-1.5 text-center font-mono font-bold tabular-nums ${
                isLive
                  ? "bg-pitch-600/30 text-pitch-200"
                  : played
                    ? "bg-black/40 text-amber-200"
                    : "text-blue-300/70"
              }`}
            >
              {score}
            </span>
            {isLive && elapsed != null && (
              <span className="text-[0.7em] font-bold text-pitch-300">{elapsed}&apos;</span>
            )}
          </span>

          {/* Visitante */}
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            {awayFlag && <Flag src={awayFlag} alt={awayName} />}
            <span className={`truncate font-semibold ${fx.awayWinner ? "text-white" : "text-blue-100/90"}`}>
              {awayName}
            </span>
          </span>
        </button>

        {/* Estado / hora */}
        <div className="flex shrink-0 items-center gap-1 border-l border-blue-950/60 px-2">
          {isLive ? (
            <span className="flex items-center gap-1 font-mono text-[0.85em] font-bold text-pitch-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-pitch-400" />
              EN VIVO
            </span>
          ) : isFinished ? (
            <span className="text-[0.78em] font-bold uppercase tracking-wide text-blue-300/70">Final</span>
          ) : (
            <span className="whitespace-nowrap text-[0.78em] text-blue-200/70">
              {dateFmt.format(new Date(fx.date))}
            </span>
          )}
          {played && (
            <ChevronDown
              className={`h-3.5 w-3.5 text-blue-300/60 transition-transform ${open ? "rotate-180" : ""}`}
            />
          )}
        </div>
      </div>

      {/* Goleadores */}
      {open && (
        <div className="border-t border-blue-950/60 bg-black/30 px-3 py-2 text-[clamp(10px,1cqi,13px)]">
          {loading ? (
            <span className="flex items-center gap-2 text-blue-200/70">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando goleadores…
            </span>
          ) : goals && goals.length > 0 ? (
            <ul className="space-y-0.5">
              {goals.map((g, i) => {
                const isHome = fx.homeId
                  ? (WC2026_TEAMS.find((t) => t.id === fx.homeId)?.nameEn?.toLowerCase().startsWith(g.teamAbbr.toLowerCase().slice(0, 3)) ?? false)
                  : false;
                return (
                  <li key={i} className="flex items-center gap-2 text-blue-100/90">
                    <span className="w-8 shrink-0 font-mono tabular-nums text-amber-300">
                      {g.elapsed ?? "?"}&apos;
                    </span>
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${isHome ? "bg-blue-400" : "bg-amber-400"}`} />
                    <span className="truncate">
                      {g.player}
                      {g.type === "penalty" && <span className="ml-1 text-amber-300/80">(p)</span>}
                      {g.type === "ownGoal" && <span className="ml-1 text-red-300/80">(p.p.)</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <span className="text-blue-300/60">Sin goles registrados.</span>
          )}
        </div>
      )}
    </div>
  );
}
