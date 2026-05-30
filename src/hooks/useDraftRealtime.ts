"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Draft, DraftPick, UserTeamEntry } from "@/types/domain";

export interface DraftRealtimeState {
  draft: Draft;
  picks: DraftPick[];
  teams: UserTeamEntry[];
}

// Suscribe a los cambios del draft de una liga y mantiene draft/picks/teams
// frescos. Ante cualquier evento (insert/update/delete) hace un refetch
// debounced de las tres tablas — robusto frente a picks, auto-skips y reinicios.
export function useDraftRealtime(
  leagueId: string,
  initial: DraftRealtimeState
): DraftRealtimeState & { refetch: () => void } {
  const [state, setState] = useState<DraftRealtimeState>(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refetch = useCallback(async () => {
    const supabase = createClient();
    const [draftRes, picksRes, teamsRes] = await Promise.all([
      supabase.from("drafts").select("*").eq("league_id", leagueId).single(),
      supabase.from("draft_picks").select("*").eq("league_id", leagueId).order("pick_number", { ascending: true }),
      supabase.from("user_teams").select("*").eq("league_id", leagueId),
    ]);
    setState((prev) => ({
      draft: (draftRes.data as Draft) ?? prev.draft,
      picks: (picksRes.data as DraftPick[]) ?? prev.picks,
      teams: (teamsRes.data as UserTeamEntry[]) ?? prev.teams,
    }));
  }, [leagueId]);

  const scheduleRefetch = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(refetch, 150);
  }, [refetch]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`draft:${leagueId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "drafts", filter: `league_id=eq.${leagueId}` }, scheduleRefetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "draft_picks", filter: `league_id=eq.${leagueId}` }, scheduleRefetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_teams", filter: `league_id=eq.${leagueId}` }, scheduleRefetch)
      .subscribe();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [leagueId, scheduleRefetch]);

  return { ...state, refetch };
}
