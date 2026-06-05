"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { LeagueStatus } from "@/types/domain";

const TIMER_OPTIONS = Array.from({ length: 20 }, (_, i) => (i + 1) * 1800); // 30 min … 10 h
function formatTurn(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export default function DraftControls({
  leagueId,
  status,
  drawn,
  membersCount,
  hasPicks,
  hasDraft,
  timerEnabled,
  turnSeconds,
}: {
  leagueId: string;
  status: LeagueStatus;
  drawn: boolean;
  membersCount: number;
  hasPicks: boolean;
  hasDraft: boolean;
  timerEnabled: boolean;
  turnSeconds: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secs, setSecs] = useState(turnSeconds);

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

  async function setTimer(enabled: boolean, seconds?: number) {
    setError(null);
    setBusy("timer");
    const supabase = createClient();
    const { error } = await supabase.rpc("set_draft_timer", {
      p_league_id: leagueId,
      p_enabled: enabled,
      p_turn_seconds: seconds ?? null,
    });
    setBusy(null);
    if (error) {
      setError(error.message);
      return;
    }
    router.refresh();
  }

  const canDraw = status === "pending_players" || status === "pending_draw";
  const canStart = status === "pending_draw" && drawn && membersCount >= 2;
  const canToggleTimer = hasDraft && status !== "draft_finished";

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

        {hasDraft && hasPicks && (
          <button
            className="btn bg-amber-500/90 text-white hover:bg-amber-500"
            disabled={busy !== null}
            onClick={() =>
              call(
                "admin_undo_last_pick",
                "undo",
                "¿Deshacer el último pick? Se liberará el jugador y el turno volverá a ese participante (el draft quedará activo)."
              )
            }
          >
            {busy === "undo" ? "Deshaciendo…" : "Deshacer último pick"}
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

      {/* Cronómetro por turno — se puede activar/desactivar durante el draft */}
      {canToggleTimer && (
        <div className="mt-4 rounded-lg border border-line bg-surface-2 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Cronómetro por turno</p>
              <p className="mt-0.5 text-xs text-muted">
                {timerEnabled ? `Activado · ${formatTurn(turnSeconds)}` : "Desactivado"}
                {" · "}se aplica desde el <span className="text-foreground">próximo turno</span>
              </p>
            </div>
            <button
              className={`btn ${timerEnabled ? "border border-line bg-surface text-foreground" : "btn-gold"}`}
              disabled={busy !== null}
              onClick={() => setTimer(!timerEnabled, timerEnabled ? undefined : secs)}
            >
              {busy === "timer" ? "Guardando…" : timerEnabled ? "Desactivar" : "Activar"}
            </button>
          </div>

          {timerEnabled && (
            <div className="mt-3 flex items-center gap-2">
              <label className="text-xs text-muted">Tiempo por turno</label>
              <select
                className="input max-w-[10rem]"
                value={secs}
                disabled={busy !== null}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setSecs(v);
                  setTimer(true, v);
                }}
              >
                {TIMER_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {formatTurn(s)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {!drawn && canDraw && membersCount < 2 && (
        <p className="mt-3 text-xs text-muted">Necesitas al menos 2 participantes para sortear.</p>
      )}
      {error && (
        <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
      )}
    </div>
  );
}
