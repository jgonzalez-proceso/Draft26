"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { LeagueStatus } from "@/types/domain";

export default function DraftControls({
  leagueId,
  status,
  drawn,
  membersCount,
  hasPicks,
}: {
  leagueId: string;
  status: LeagueStatus;
  drawn: boolean;
  membersCount: number;
  hasPicks: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(fn: string, label: string, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setError(null);
    setBusy(label);
    const supabase = createClient();
    const { error } = await supabase.rpc(fn, { p_league_id: leagueId });
    setBusy(null);
    if (error) {
      setError(error.message);
      return;
    }
    router.refresh();
  }

  const canDraw = status === "pending_players" || status === "pending_draw";
  const canStart = status === "pending_draw" && drawn && membersCount >= 2;

  return (
    <div className="card p-5">
      <h3 className="font-bold">Control del draft</h3>
      <p className="mt-1 text-sm text-muted">
        Gestiona el ciclo de vida del draft de la liga.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {canDraw && (
          <button
            className="btn-gold"
            disabled={busy !== null || membersCount < 2}
            onClick={() => call("draw_draft_order", "draw")}
          >
            {busy === "draw" ? "Sorteando…" : drawn ? "Re-sortear orden" : "Sortear orden"}
          </button>
        )}

        {status === "pending_draw" && (
          <button
            className="btn-primary"
            disabled={busy !== null || !canStart}
            onClick={() => call("start_draft", "start")}
            title={!drawn ? "Primero sortea el orden" : ""}
          >
            {busy === "start" ? "Iniciando…" : "Iniciar draft"}
          </button>
        )}

        {status === "draft_active" && (
          <button className="btn-ghost" disabled={busy !== null} onClick={() => call("pause_draft", "pause")}>
            {busy === "pause" ? "Pausando…" : "Pausar"}
          </button>
        )}

        {status === "draft_paused" && (
          <button className="btn-primary" disabled={busy !== null} onClick={() => call("resume_draft", "resume")}>
            {busy === "resume" ? "Reanudando…" : "Reanudar"}
          </button>
        )}

        {(status === "draft_active" || status === "draft_paused") && (
          <button
            className="btn-ghost"
            disabled={busy !== null}
            onClick={() =>
              call("finish_draft", "finish", "¿Finalizar el draft? No podrán hacerse más picks.")
            }
          >
            {busy === "finish" ? "Finalizando…" : "Finalizar"}
          </button>
        )}

        {(hasPicks || status === "draft_finished" || status === "draft_active" || status === "draft_paused") && (
          <button
            className="btn bg-red-500/90 text-white hover:bg-red-500"
            disabled={busy !== null}
            onClick={() =>
              call(
                "reset_draft",
                "reset",
                "¿Reiniciar el draft? Se borrarán TODOS los picks y equipos. El orden sorteado se conserva."
              )
            }
          >
            {busy === "reset" ? "Reiniciando…" : "Reiniciar draft"}
          </button>
        )}
      </div>

      {!drawn && canDraw && membersCount < 2 && (
        <p className="mt-3 text-xs text-muted">Necesitas al menos 2 participantes para sortear.</p>
      )}
      {error && (
        <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
      )}
    </div>
  );
}
