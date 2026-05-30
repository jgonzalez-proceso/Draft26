"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useDraftRealtime, type DraftRealtimeState } from "@/hooks/useDraftRealtime";
import SquadTable from "@/components/players/SquadTable";
import type { PlayerWithTeam } from "@/types/domain";

interface Team {
  id: string;
  name: string;
  flag_url: string | null;
  group: string | null;
}

export default function SquadExplorer({
  leagueId,
  userId,
  teams,
  players,
  initial,
}: {
  leagueId: string;
  userId: string;
  teams: Team[];
  players: PlayerWithTeam[];
  initial: DraftRealtimeState;
}) {
  const { draft, teams: userTeams, refetch } = useDraftRealtime(leagueId, initial);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pickedIds = useMemo(() => new Set(userTeams.map((t) => t.player_id)), [userTeams]);
  const playersByTeam = useMemo(() => {
    const m = new Map<string, PlayerWithTeam[]>();
    for (const p of players) {
      if (!m.has(p.national_team_id)) m.set(p.national_team_id, []);
      m.get(p.national_team_id)!.push(p);
    }
    return m;
  }, [players]);

  const isMyTurn = draft.status === "draft_active" && draft.current_turn_user_id === userId;

  async function onPick(playerId: string) {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("make_pick", { p_draft_id: draft.id, p_player_id: playerId });
    if (error) setError(error.message);
    refetch();
  }

  // Grupos del Mundial
  const groups = useMemo(() => {
    const g = new Map<string, Team[]>();
    for (const t of [...teams].sort((a, b) => a.name.localeCompare(b.name))) {
      const key = t.group ?? "—";
      if (!g.has(key)) g.set(key, []);
      g.get(key)!.push(t);
    }
    return [...g.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [teams]);

  const selTeam = teams.find((t) => t.id === selected) ?? null;

  return (
    <div className="space-y-4">
      {isMyTurn && (
        <div className="rounded-lg border border-gold-500 bg-gold-500/10 px-4 py-2 text-sm font-semibold text-gold-300">
          ¡Es tu turno! Entra en una selección y elige un jugador.
        </div>
      )}
      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
      )}

      {selTeam ? (
        <SquadTable
          teamName={selTeam.name}
          teamFlag={selTeam.flag_url}
          teamGroup={selTeam.group}
          players={playersByTeam.get(selTeam.id) ?? []}
          pickedIds={pickedIds}
          canPick={isMyTurn}
          onPick={onPick}
          onBack={() => setSelected(null)}
        />
      ) : (
        <div className="space-y-6">
          {groups.map(([groupKey, groupTeams]) => (
            <div key={groupKey}>
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted">
                {groupKey === "—" ? "Selecciones" : `Grupo ${groupKey}`}
              </h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {groupTeams.map((t) => {
                  const squad = playersByTeam.get(t.id) ?? [];
                  const free = squad.filter((p) => !pickedIds.has(p.id) && p.is_available).length;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelected(t.id)}
                      className="card flex items-center gap-3 p-3 text-left transition-colors hover:border-pitch-500"
                    >
                      <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-md border border-gold-500/50 bg-surface-2">
                        {t.flag_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={t.flag_url} alt={t.name} className="h-full w-full object-cover" />
                        ) : (
                          <span>🏳️</span>
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{t.name}</span>
                        <span className="block text-xs text-muted">{free}/{squad.length} libres</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
