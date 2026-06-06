"use client";

import { useMemo, useState } from "react";
import { Check, Lock, Save } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useDraftRealtime, type DraftRealtimeState } from "@/hooks/useDraftRealtime";
import { createClient } from "@/lib/supabase/client";
import Pitch, { Chip } from "@/components/teams/Pitch";
import { FORMATIONS, DEFAULT_FORMATION, autoSlotIds, buildLineupFromIds } from "@/lib/formations";
import { POSITION_COLORS, POSITIONS, type PlayerWithTeam, type UserLineup } from "@/types/domain";

interface Member {
  user_id: string;
  display_name: string;
}

export default function TeamView({
  leagueId,
  members,
  players,
  initial,
  initialUserId,
  isAdmin,
  initialLineups,
}: {
  leagueId: string;
  members: Member[];
  players: PlayerWithTeam[];
  initial: DraftRealtimeState;
  initialUserId: string;
  isAdmin: boolean;
  initialLineups: UserLineup[];
}) {
  const { teams } = useDraftRealtime(leagueId, initial);
  const [userId, setUserId] = useState(initialUserId);

  // Formación y colocación (ids por hueco) guardadas por usuario.
  const [formations, setFormations] = useState<Map<string, string>>(
    () => new Map(initialLineups.map((l) => [l.user_id, l.formation])),
  );
  const [slotsMap, setSlotsMap] = useState<Map<string, (string | null)[]>>(
    () => new Map(initialLineups.map((l) => [l.user_id, l.slots])),
  );

  const canEdit = userId === initialUserId || isAdmin;

  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const squad = useMemo(
    () =>
      teams
        .filter((t) => t.user_id === userId)
        .map((t) => playerById.get(t.player_id))
        .filter((p): p is PlayerWithTeam => !!p),
    [teams, userId, playerById],
  );

  const currentFormation = formations.get(userId) ?? DEFAULT_FORMATION;
  // Colocación efectiva: la guardada/manual, o el reparto automático por posición.
  const currentSlots = useMemo(
    () => slotsMap.get(userId) ?? autoSlotIds(squad, currentFormation),
    [slotsMap, userId, squad, currentFormation],
  );

  const { lineup, bench } = useMemo(
    () => buildLineupFromIds(squad, currentFormation, currentSlots),
    [squad, currentFormation, currentSlots],
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  async function handleSave() {
    if (!canEdit || saving) return;
    setSaving(true);
    setSaveOk(false);
    setSaveError(null);
    const ids = new Set(squad.map((p) => p.id));
    const sane = currentSlots.map((s) => (s && ids.has(s) ? s : null));
    const supabase = createClient();
    const { error } = await supabase.rpc("save_lineup", {
      p_league_id: leagueId,
      p_user_id: userId,
      p_formation: currentFormation,
      p_slots: sane,
    });
    setSaving(false);
    if (error) {
      setSaveError(error.message);
    } else {
      setDirty(false);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2500);
    }
  }

  function changeFormation(f: string) {
    if (!canEdit) return;
    const newSlots = autoSlotIds(squad, f);
    setFormations((prev) => new Map(prev).set(userId, f));
    setSlotsMap((prev) => new Map(prev).set(userId, newSlots));
    setDirty(true);
    setSaveOk(false);
  }

  function onDragEnd(e: DragEndEvent) {
    if (!canEdit) return;
    const data = e.active.data.current as { playerId: string; fromSlot: number | null } | undefined;
    const overId = e.over?.id as string | undefined;
    if (!data || !overId) return;
    const { playerId, fromSlot } = data;

    const next = currentSlots.slice();
    if (overId.startsWith("slot:")) {
      const j = Number(overId.slice(5));
      const occupant = next[j] ?? null;
      if (fromSlot != null) {
        next[fromSlot] = occupant; // intercambio entre dos huecos
        next[j] = playerId;
      } else {
        next[j] = playerId; // del banquillo a un hueco (el ocupante baja al banquillo)
      }
    } else if (overId === "bench") {
      if (fromSlot != null) next[fromSlot] = null; // del campo al banquillo
      else return;
    } else {
      return;
    }

    setSlotsMap((prev) => new Map(prev).set(userId, next));
    setDirty(true);
    setSaveOk(false);
  }

  const countByPos = (pos: string) => squad.filter((p) => p.primary_position === pos).length;
  const viewedMember = members.find((m) => m.user_id === userId);

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_18rem]">
        {/* Campo */}
        <div className="space-y-3">
          {/* Selector de participante */}
          <div className="flex flex-wrap gap-1.5">
            {members.map((m) => (
              <button
                key={m.user_id}
                onClick={() => setUserId(m.user_id)}
                className={`btn px-3 py-1.5 text-sm ${
                  m.user_id === userId
                    ? "bg-pitch-500 text-white"
                    : "border border-line bg-surface-2 text-foreground"
                }`}
              >
                {m.display_name}
              </button>
            ))}
          </div>

          <Pitch lineup={lineup} editable={canEdit} />
          {canEdit && (
            <p className="text-xs text-muted">
              Arrastra los jugadores entre el campo y el banquillo.{" "}
              {dirty && <span className="text-gold-400">Tienes cambios sin guardar.</span>}
            </p>
          )}
        </div>

        {/* Menú lateral estilo PES */}
        <div className="space-y-4">
          {/* Táctica */}
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">Táctica</h3>
              {!canEdit && (
                <span className="flex items-center gap-1 text-xs text-muted">
                  <Lock className="h-3 w-3" />
                  Solo lectura
                </span>
              )}
            </div>

            {canEdit ? (
              <>
                <p className="mt-1 text-xs text-muted">
                  {userId === initialUserId
                    ? "Cambia la formación de tu equipo."
                    : `Editando equipo de ${viewedMember?.display_name ?? "participante"} (admin).`}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {Object.keys(FORMATIONS).map((f) => (
                    <button
                      key={f}
                      onClick={() => changeFormation(f)}
                      className={`btn px-2 py-1.5 text-sm ${
                        f === currentFormation
                          ? "bg-gold-500 text-slate-900"
                          : "border border-line bg-surface-2"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleSave}
                  disabled={saving || (!dirty && !saveError)}
                  className={`btn mt-3 w-full py-2 text-sm font-semibold ${
                    saveOk
                      ? "bg-green-600/80 text-white"
                      : dirty || saveError
                      ? "btn-primary"
                      : "border border-line bg-surface-2 text-muted"
                  }`}
                >
                  {saving ? (
                    "Guardando…"
                  ) : saveOk ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Check className="h-4 w-4" /> Guardado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <Save className="h-4 w-4" />
                      {dirty ? "Guardar cambios" : "Guardar"}
                    </span>
                  )}
                </button>
                {saveError && (
                  <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">
                    {saveError}
                  </p>
                )}
              </>
            ) : (
              <p className="mt-2 text-xs text-muted">
                Estás viendo el equipo de{" "}
                <span className="font-semibold text-foreground">
                  {viewedMember?.display_name ?? "otro participante"}
                </span>
                . Solo el administrador o el propio jugador pueden modificarlo.
              </p>
            )}
          </div>

          {/* Plantilla */}
          <div className="card p-4">
            <h3 className="font-bold">Plantilla</h3>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {POSITIONS.map((pos) => (
                <span key={pos} className={`badge ${POSITION_COLORS[pos]}`}>
                  {pos} {countByPos(pos)}
                </span>
              ))}
              <span className="badge bg-surface-2 text-muted">Total {squad.length}</span>
            </div>
          </div>

          {/* Banquillo (zona para soltar y arrastrar) */}
          <Bench bench={bench} editable={canEdit} />
        </div>
      </div>
    </DndContext>
  );
}

function Bench({ bench, editable }: { bench: PlayerWithTeam[]; editable: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: "bench", disabled: !editable });
  return (
    <div ref={setNodeRef} className={`card p-4 ${isOver ? "ring-2 ring-gold-400" : ""}`}>
      <h3 className="font-bold">Banquillo</h3>
      {bench.length === 0 ? (
        <p className="mt-2 text-xs text-muted">
          {editable ? "Arrastra aquí para quitar a un jugador del once." : "Sin suplentes."}
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-3">
          {bench.map((p) => (
            <Chip key={p.id} player={p} fromSlot={null} editable={editable} />
          ))}
        </div>
      )}
    </div>
  );
}
