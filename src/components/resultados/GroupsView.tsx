"use client";

import { useMemo, useState } from "react";
import StandingsTable from "./StandingsTable";
import MatchRow from "./MatchRow";
import type { MergedFixture, StandingRow } from "@/lib/espnFootball";

interface Group {
  name: string;   // "A" … "L"
  standings: StandingRow[];
  fixtures: MergedFixture[];
}

export default function GroupsView({ groups }: { groups: Group[] }) {
  // Jornadas disponibles (extraídas de los rounds tipo "Group X - N")
  const rounds = useMemo(() => {
    const set = new Set<number>();
    for (const g of groups) {
      for (const f of g.fixtures) {
        const m = f.round.match(/(\d+)\s*$/);
        if (m) set.add(Number(m[1]));
      }
    }
    return [...set].sort((a, b) => a - b);
  }, [groups]);

  const [round, setRound] = useState<number | "all">("all");

  if (groups.length === 0) {
    return (
      <p className="px-3 py-10 text-center text-sm text-blue-200/70">
        Grupos no disponibles.
      </p>
    );
  }

  return (
    <div>
      {/* Selector de jornada */}
      {rounds.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-200/60">
            Jornada
          </span>
          <JBtn active={round === "all"} onClick={() => setRound("all")}>
            Todas
          </JBtn>
          {rounds.map((n) => (
            <JBtn key={n} active={round === n} onClick={() => setRound(n)}>
              {n}
            </JBtn>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => {
          const filtered =
            round === "all"
              ? g.fixtures
              : g.fixtures.filter((f) => {
                  const m = f.round.match(/(\d+)\s*$/);
                  return m ? Number(m[1]) === round : false;
                });
          return (
            <div key={g.name} className="flex flex-col gap-1.5">
              <StandingsTable groupName={g.name} rows={g.standings} />
              <div className="space-y-1">
                {filtered.map((f) => (
                  <MatchRow key={f.id} fx={f} compact />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function JBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`min-w-[2rem] rounded px-2 py-1 text-xs font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-300/70 ${
        active
          ? "bg-amber-400 text-blue-950"
          : "bg-blue-950/60 text-blue-100 hover:bg-blue-900"
      }`}
    >
      {children}
    </button>
  );
}
