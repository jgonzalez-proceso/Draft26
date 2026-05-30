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
  const [turnSeconds, setTurnSeconds] = useState(initialTurnSeconds);
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
            <label className="mb-1 block text-xs text-muted">Segundos por pick: {turnSeconds}s</label>
            <input
              type="range"
              min={15}
              max={300}
              step={15}
              value={turnSeconds}
              disabled={locked}
              onChange={(e) => setTurnSeconds(Number(e.target.value))}
              className="w-full accent-gold-500"
            />
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
