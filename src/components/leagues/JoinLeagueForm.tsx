"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function JoinLeagueForm({ initialCode = "" }: { initialCode?: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("join_league", {
      p_invite_code: code.trim(),
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
        <label className="mb-1 block text-sm font-medium">Código de invitación</label>
        <input
          className="input text-center font-mono text-lg uppercase tracking-widest"
          required
          maxLength={8}
          placeholder="ABC123"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
      </div>
      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
      )}
      <button className="btn-gold w-full py-2.5" disabled={loading} type="submit">
        {loading ? "Uniéndome…" : "Unirme a la liga"}
      </button>
    </form>
  );
}
