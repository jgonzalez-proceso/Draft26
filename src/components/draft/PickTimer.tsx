"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Cuenta atrás hasta pick_deadline. Si autoExpire (cliente del turno activo) y
// llega a 0, llama a expire_turn (idempotente) para saltar el turno.
export default function PickTimer({
  draftId,
  deadline,
  turnSeconds,
  autoExpire,
  onExpire,
}: {
  draftId: string;
  deadline: string | null;
  turnSeconds: number;
  autoExpire: boolean;
  onExpire: () => void;
}) {
  const [remaining, setRemaining] = useState<number>(0);
  const firedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!deadline) {
      setRemaining(0);
      return;
    }
    const end = new Date(deadline).getTime();

    const tick = async () => {
      const ms = end - Date.now();
      const secs = Math.max(0, Math.ceil(ms / 1000));
      setRemaining(secs);

      if (secs <= 0 && autoExpire && firedFor.current !== deadline) {
        firedFor.current = deadline; // evita llamadas repetidas para el mismo deadline
        const supabase = createClient();
        await supabase.rpc("expire_turn", { p_draft_id: draftId });
        onExpire();
      }
    };

    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [deadline, autoExpire, draftId, onExpire]);

  if (!deadline) {
    return <span className="font-mono text-sm text-muted">sin límite</span>;
  }

  const pct = Math.min(100, (remaining / Math.max(1, turnSeconds)) * 100);
  const danger = remaining <= 10;

  return (
    <div className="flex items-center gap-2">
      <div className="relative h-2 w-24 overflow-hidden rounded-full bg-surface-2">
        <div
          className={`absolute inset-y-0 left-0 transition-all duration-500 ${danger ? "bg-red-500" : "bg-gold-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`font-mono text-lg font-bold tabular-nums ${danger ? "text-red-400" : "text-gold-300"}`}>
        {remaining}s
      </span>
    </div>
  );
}
