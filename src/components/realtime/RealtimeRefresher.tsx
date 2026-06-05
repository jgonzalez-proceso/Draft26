"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Refresca los datos de servidor de TODAS las páginas de la liga cuando cambia
// algo del draft (picks, estado, equipos, miembros). Así el menú, el historial,
// los contadores, etc. se actualizan solos sin recargar a mano. Las vistas que ya
// usan useDraftRealtime siguen actualizándose al instante en cliente; esto es la
// red de seguridad para los Server Components.
export default function RealtimeRefresher({ leagueId }: { leagueId: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 200);
    };

    const f = `league_id=eq.${leagueId}`;
    const channel = supabase
      .channel(`league-refresh:${leagueId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "drafts", filter: f }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "draft_picks", filter: f }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_teams", filter: f }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "league_members", filter: f }, refresh)
      .subscribe();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [leagueId, router]);

  return null;
}
