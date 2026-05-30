"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ProfileForm({
  initialDisplayName,
  email,
}: {
  initialDisplayName: string;
  email: string;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      data: { display_name: displayName },
    });
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("profiles").update({ display_name: displayName }).eq("id", user.id);
      }
    }
    setMsg(error ? error.message : "Perfil actualizado");
    setSaving(false);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Email</label>
        <input className="input opacity-60" value={email} disabled />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Nombre visible</label>
        <input
          className="input"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Tu nombre en la liga"
        />
      </div>
      {msg && <p className="text-sm text-pitch-300">{msg}</p>}
      <button className="btn-primary" disabled={saving} type="submit">
        {saving ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}
