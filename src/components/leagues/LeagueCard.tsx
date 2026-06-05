"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import StatusBadge from "@/components/leagues/StatusBadge";
import type { LeagueStatus, MemberRole } from "@/types/domain";

export interface LeagueCardData {
  id: string;
  name: string;
  status: LeagueStatus;
  world_cup_year: number;
  max_participants: number;
  invite_code: string;
}

export default function LeagueCard({
  league,
  role,
}: {
  league: LeagueCardData;
  role: MemberRole;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function leave(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const extra =
      role === "admin"
        ? " Si eres el único admin, se promoverá a otro participante; si eres el último miembro, la liga se eliminará."
        : "";
    if (!window.confirm(`¿Abandonar la liga «${league.name}»?${extra}`)) return;
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("leave_league", { p_league_id: league.id });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="card relative p-5 transition-colors hover:border-pitch-500">
      {/* Capa de navegación: cubre la tarjeta para abrir la liga al hacer clic */}
      <Link
        href={`/ligas/${league.id}`}
        aria-label={`Abrir ${league.name}`}
        className="absolute inset-0 z-10 rounded-[inherit]"
      />

      <div className="relative z-0">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-bold">{league.name}</h2>
          <StatusBadge status={league.status} />
        </div>
        <p className="mt-1 text-sm text-muted">
          Mundial {league.world_cup_year} · Máx. {league.max_participants} ·{" "}
          {role === "admin" ? "Admin" : "Participante"}
        </p>
        <p className="mt-3 font-mono text-xs text-muted">
          Código: <span className="text-gold-400">{league.invite_code}</span>
        </p>
        {error && (
          <p className="relative z-20 mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        )}
      </div>

      {/* Botón abandonar, por encima de la capa de navegación */}
      <button
        type="button"
        onClick={leave}
        disabled={busy}
        title="Abandonar liga"
        aria-label={`Abandonar ${league.name}`}
        className="absolute bottom-3 right-3 z-20 inline-flex items-center gap-1.5 rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-50"
      >
        <LogOut className="h-3.5 w-3.5" />
        {busy ? "Saliendo…" : "Abandonar"}
      </button>
    </div>
  );
}
