"use client";

import { useMemo } from "react";
import MatchRow from "./MatchRow";
import type { MergedFixture } from "@/lib/espnFootball";

const KNOCKOUT_ORDER = [
  "Round of 32",
  "Round of 16",
  "Quarter-finals",
  "Semi-finals",
  "3rd Place Final",
  "Final",
] as const;

const KNOCKOUT_LABEL: Record<string, string> = {
  "Round of 32": "Dieciseisavos",
  "Round of 16": "Octavos",
  "Quarter-finals": "Cuartos",
  "Semi-finals": "Semifinales",
  "3rd Place Final": "3.º y 4.º puesto",
  Final: "Final",
};

export default function BracketView({ fixtures }: { fixtures: MergedFixture[] }) {
  const columns = useMemo(() => {
    const ko = fixtures.filter((f) => f.phase === "knockout");
    return KNOCKOUT_ORDER.map((round) => ({
      round,
      label: KNOCKOUT_LABEL[round] ?? round,
      matches: ko
        .filter((f) => f.round === round)
        .sort((a, b) => a.date.localeCompare(b.date)),
    })).filter((c) => c.matches.length > 0);
  }, [fixtures]);

  if (columns.length === 0) {
    return (
      <p className="px-3 py-10 text-center text-sm text-blue-200/70">
        El cuadro de eliminatorias se mostrará cuando se conozcan los cruces.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-3">
        {columns.map((col) => (
          <section
            key={col.round}
            className="flex w-[clamp(220px,24cqi,300px)] shrink-0 flex-col"
          >
            <h3 className="mb-2 rounded bg-gradient-to-b from-blue-700 to-blue-900 px-2 py-1 text-center text-[clamp(11px,1.2cqi,14px)] font-extrabold uppercase tracking-wide text-white">
              {col.label}
            </h3>
            <div className="flex flex-1 flex-col justify-around gap-2">
              {col.matches.map((f) => (
                <MatchRow key={f.id} fx={f} compact />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
