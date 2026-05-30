"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CreateLeagueForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [maxParticipants, setMaxParticipants] = useState(12);
  const [timerEnabled, setTimerEnabled] = useState(true);
  const [turnSeconds, setTurnSeconds] = useState(90);
  const [picksPerUser, setPicksPerUser] = useState<number | "">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("create_league", {
      p_name: name,
      p_max_participants: maxParticipants,
      p_world_cup_year: 2026,
      p_draft_mode: "snake",
      p_timer_enabled: timerEnabled,
      p_turn_seconds: turnSeconds,
      p_picks_per_user: picksPerUser === "" ? null : picksPerUser,
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push(`/ligas/${data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Nombre de la liga</label>
        <input
          className="input"
          required
          placeholder="La liga de los amigos"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">
          Máximo de participantes: {maxParticipants}
        </label>
        <input
          type="range"
          min={2}
          max={32}
          value={maxParticipants}
          onChange={(e) => setMaxParticipants(Number(e.target.value))}
          className="w-full accent-pitch-500"
        />
      </div>

      <div className="card border-line bg-surface-2 p-4">
        <label className="flex items-center justify-between">
          <span className="text-sm font-medium">Tiempo por turno (cronómetro)</span>
          <input
            type="checkbox"
            checked={timerEnabled}
            onChange={(e) => setTimerEnabled(e.target.checked)}
            className="h-4 w-4 accent-gold-500"
          />
        </label>
        {timerEnabled && (
          <div className="mt-3">
            <label className="mb-1 block text-xs text-muted">
              Segundos por pick: {turnSeconds}s
            </label>
            <input
              type="range"
              min={15}
              max={300}
              step={15}
              value={turnSeconds}
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
          placeholder="Sin límite (lo finaliza el admin)"
          value={picksPerUser}
          onChange={(e) =>
            setPicksPerUser(e.target.value === "" ? "" : Number(e.target.value))
          }
        />
        <p className="mt-1 text-xs text-muted">
          Si lo defines, el draft termina al alcanzar ese número de picks por participante.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
      )}

      <button className="btn-gold w-full py-2.5" disabled={loading} type="submit">
        {loading ? "Creando…" : "Crear liga"}
      </button>
    </form>
  );
}
