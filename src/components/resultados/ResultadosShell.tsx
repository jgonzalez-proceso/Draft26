"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, Trophy, Target, RefreshCw, RadioTower } from "lucide-react";
import GroupsView from "./GroupsView";
import BracketView from "./BracketView";
import ScorersView from "./ScorersView";
import type { MergedFixture, StandingRow, Scorer } from "@/lib/espnFootball";

type View = "grupos" | "eliminatorias" | "goleadores";

const TABS: { id: View; label: string; icon: typeof LayoutGrid }[] = [
  { id: "grupos", label: "Fase de Grupos", icon: LayoutGrid },
  { id: "eliminatorias", label: "Eliminatorias", icon: Trophy },
  { id: "goleadores", label: "Goleadores", icon: Target },
];

interface GroupData {
  name: string;
  standings: StandingRow[];
  fixtures: MergedFixture[];
}

export default function ResultadosShell({
  groups,
  allFixtures,
  scorers,
  dataSource,
}: {
  groups: GroupData[];
  allFixtures: MergedFixture[];
  scorers: Scorer[];
  dataSource: "espn" | "n8n" | "static";
}) {
  const [view, setView] = useState<View>("grupos");
  const router = useRouter();
  const liveCount = allFixtures.filter((f) => f.statusShort === "in").length;

  const sourceLabel =
    dataSource === "n8n" ? "N8N → Supabase" : dataSource === "espn" ? "ESPN" : "estático";

  return (
    <div
      className="mx-auto overflow-hidden rounded-xl border-2 border-blue-950 bg-gradient-to-b from-[#0a1730] to-[#070f22] shadow-[0_12px_50px_rgba(0,0,0,0.55)]"
      style={{
        containerType: "inline-size",
        // Full-bleed centrado: sale del max-w-6xl del dashboard y usa casi todo el ancho
        position: "relative",
        left: "50%",
        transform: "translateX(-50%)",
        width: "min(1680px, calc(100vw - 2rem))",
      }}
    >
      {/* ── Barra superior ── */}
      <header className="flex items-center justify-between gap-3 border-b-2 border-blue-950 bg-gradient-to-b from-blue-800 to-blue-950 px-3 py-2 sm:px-4">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-gradient-to-b from-amber-300 to-amber-600 text-blue-950 ring-1 ring-amber-200/50">
            <Trophy className="h-5 w-5" />
          </span>
          <div className="leading-none">
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-blue-200/70">
              Copa del Mundo
            </p>
            <p className="text-lg font-black uppercase italic tracking-tight text-white">
              2026
            </p>
          </div>
        </div>

        <h1 className="hidden text-2xl font-black uppercase italic tracking-wide text-amber-300 drop-shadow-[0_2px_2px_rgba(0,0,0,0.6)] sm:block">
          Resultados
        </h1>

        <div className="flex items-center gap-2">
          {liveCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-pitch-600/30 px-2 py-1 text-xs font-bold text-pitch-200 ring-1 ring-pitch-400/40">
              <RadioTower className="h-3.5 w-3.5 animate-pulse" />
              {liveCount} en vivo
            </span>
          )}
          <button
            onClick={() => router.refresh()}
            title="Actualizar resultados"
            aria-label="Actualizar resultados"
            className="grid h-8 w-8 place-items-center rounded-md border border-white/15 bg-black/30 text-blue-100 outline-none transition-colors hover:bg-black/50 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-300/70"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_13rem]">
        {/* ── Contenido principal ── */}
        <main className="order-2 min-w-0 p-3 sm:p-4 md:order-1">
          {view === "grupos" && <GroupsView groups={groups} />}
          {view === "eliminatorias" && <BracketView fixtures={allFixtures} />}
          {view === "goleadores" && <ScorersView scorers={scorers} />}
        </main>

        {/* ── Barra lateral de fases ── */}
        <nav
          aria-label="Fases del torneo"
          className="order-1 flex gap-1.5 border-blue-950 bg-[#0a1430] p-2 max-md:overflow-x-auto md:order-2 md:flex-col md:border-l-2"
        >
          {TABS.map((t) => {
            const active = view === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setView(t.id)}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[44px] flex-1 items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-300/70 md:flex-none ${
                  active
                    ? "bg-gradient-to-b from-amber-300 to-amber-500 text-blue-950 shadow"
                    : "text-blue-100 hover:bg-blue-900/60"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {t.label}
              </button>
            );
          })}

          <div className="mt-auto hidden gap-2 px-1 pt-3 text-[11px] text-blue-300/60 md:flex md:flex-col">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-1 rounded bg-pitch-400" /> Clasificado
            </span>
          </div>
        </nav>
      </div>

      {/* ── Barra inferior ── */}
      <footer className="flex items-center justify-between gap-3 border-t-2 border-blue-950 bg-gradient-to-b from-blue-950 to-[#060d1c] px-3 py-1.5 text-[11px] text-blue-300/70 sm:px-4">
        <span className="font-semibold uppercase tracking-wider">
          Copa del Mundo · Canadá / México / USA 2026
        </span>
        <span className="flex items-center gap-1.5">
          <RadioTower className="h-3 w-3" /> {sourceLabel}
        </span>
      </footer>
    </div>
  );
}
