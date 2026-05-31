"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { DraftMode } from "@/types/domain";

export default function DraftConfigForm({
  leagueId,
  initialMode,
  initialTimerEnabled,
  initialTurnSeconds,
  initialPicksPerUser,
  locked,
}: {
  leagueId: string;
  initialMode: DraftMode;
  initialTimerEnabled: boolean;
  initialTurnSeconds: number;
  initialPicksPerUser: number | null;
  locked: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<DraftMode>(initialMode);
  const [timerEnabled, setTimerEnabled] = useState(initialTimerEnabled);
  // Límite por turno en pasos de 30 min (mín. 30 min, máx. 10 h).
  const [turnSeconds, setTurnSeconds] = useState(() =>
    snapToStep(initialTurnSeconds),
  );
  const [picks, setPicks] = useState<number | "">(initialPicksPerUser ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("update_draft_config", {
      p_league_id: leagueId,
      p_draft_mode: mode,
      p_timer_enabled: timerEnabled,
      p_turn_seconds: turnSeconds,
      p_picks_per_user: picks === "" ? null : picks,
    });
    setSaving(false);
    if (error) setErr(error.message);
    else {
      setMsg("Guardado");
      router.refresh();
    }
  }

  return (
    <form onSubmit={save} className="card space-y-4 p-5">
      <h3 className="font-bold">Configuración del draft</h3>
      {locked && (
        <p className="rounded-lg bg-orange-500/10 px-3 py-2 text-xs text-orange-300">
          El draft ya ha comenzado: la configuración está bloqueada. Reinícialo para cambiarla.
        </p>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium">Modo</label>
        <div className="flex gap-2">
          {(["snake", "linear"] as DraftMode[]).map((m) => (
            <button
              key={m}
              type="button"
              disabled={locked}
              onClick={() => setMode(m)}
              className={`btn flex-1 ${mode === m ? "bg-pitch-500 text-white" : "border border-line bg-surface-2 text-foreground"}`}
            >
              {m === "snake" ? "Serpiente" : "Lineal"}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-line bg-surface-2 p-4">
        <label className="flex items-center justify-between">
          <span className="text-sm font-medium">Cronómetro por turno</span>
          <input
            type="checkbox"
            checked={timerEnabled}
            disabled={locked}
            onChange={(e) => setTimerEnabled(e.target.checked)}
            className="h-4 w-4 accent-gold-500"
          />
        </label>
        {timerEnabled && (
          <div className="mt-3">
            <label className="mb-1 block text-xs text-muted">
              Tiempo por turno: <span className="font-semibold text-foreground">{formatTurn(turnSeconds)}</span>
            </label>
            <input
              type="range"
              min={1800}
              max={36000}
              step={1800}
              value={turnSeconds}
              disabled={locked}
              onChange={(e) => setTurnSeconds(Number(e.target.value))}
              className="w-full accent-gold-500"
            />
            <div className="mt-1 flex justify-between text-[11px] text-muted">
              <span>30 min</span>
              <span>10 h</span>
            </div>
          </div>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">
          Jugadores por equipo <span className="text-muted">(opcional)</span>
        </label>
        <input
          className="input"
          type="number"
          min={1}
          max={50}
          disabled={locked}
          placeholder="Sin límite"
          value={picks}
          onChange={(e) => setPicks(e.target.value === "" ? "" : Number(e.target.value))}
        />
      </div>

      {err && <p className="text-sm text-red-300">{err}</p>}
      {msg && <p className="text-sm text-pitch-300">{msg}</p>}
      <button className="btn-primary" disabled={saving || locked} type="submit">
        {saving ? "Guardando…" : "Guardar configuración"}
      </button>
    </form>
  );
}

// Ajusta cualquier valor al paso de 30 min dentro de [30 min, 10 h].
function snapToStep(seconds: number): number {
  const step = 1800;
  const min = 1800;
  const max = 36000;
  const snapped = Math.round((seconds || min) / step) * step;
  return Math.min(max, Math.max(min, snapped));
}

// "1 h 30 min" / "2 h" / "30 min"
function formatTurn(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
