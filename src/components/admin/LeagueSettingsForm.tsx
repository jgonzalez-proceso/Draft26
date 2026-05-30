"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LeagueSettingsForm({
  leagueId,
  initialName,
  initialMax,
  membersCount,
}: {
  leagueId: string;
  initialName: string;
  initialMax: number;
  membersCount: number;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [max, setMax] = useState(initialMax);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("update_league_settings", {
      p_league_id: leagueId,
      p_name: name,
      p_max_participants: max,
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
      <h3 className="font-bold">Ajustes de la liga</h3>
      <div>
        <label className="mb-1 block text-sm font-medium">Nombre</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">
          Máximo de participantes: {max}
        </label>
        <input
          type="range"
          min={Math.max(2, membersCount)}
          max={32}
          value={max}
          onChange={(e) => setMax(Number(e.target.value))}
          className="w-full accent-pitch-500"
        />
        <p className="mt-1 text-xs text-muted">Mínimo {membersCount} (participantes actuales).</p>
      </div>
      {err && <p className="text-sm text-red-300">{err}</p>}
      {msg && <p className="text-sm text-pitch-300">{msg}</p>}
      <button className="btn-primary" disabled={saving} type="submit">
        {saving ? "Guardando…" : "Guardar ajustes"}
      </button>
    </form>
  );
}
