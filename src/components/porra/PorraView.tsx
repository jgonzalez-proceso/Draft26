"use client";

import React, { useState, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Trophy,
  Medal,
  Save,
  Check,
  Lock,
  Star,
  Users,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { PorraPrediction, PorraResult } from "@/types/domain";
import { computePorraScores } from "@/lib/porra";

// ---------------------------------------------------------------------------
// SortableItem
// ---------------------------------------------------------------------------
function SortableItem({
  id,
  position,
  name,
  isMe,
  disabled,
}: {
  id: string;
  position: number;
  name: string;
  isMe: boolean;
  disabled?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`card flex items-center gap-3 p-3 transition-shadow ${
        isDragging ? "z-50 shadow-lg ring-1 ring-gold-400/40" : ""
      }`}
    >
      <span className="w-7 shrink-0 text-center font-display text-xl leading-none text-gold-400">
        {position}
      </span>
      {!disabled && (
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none text-muted active:cursor-grabbing"
          aria-label="Arrastrar para reordenar"
        >
          <GripVertical className="h-5 w-5" />
        </button>
      )}
      {position === 1 && <Trophy className="h-4 w-4 shrink-0 text-gold-400" />}
      {position === 2 && <Medal className="h-4 w-4 shrink-0 text-slate-400" />}
      {position === 3 && <Medal className="h-4 w-4 shrink-0 text-amber-700" />}
      <span className="flex-1 font-medium leading-tight">{name}</span>
      {isMe && (
        <span className="rounded-full bg-pitch-500/20 px-2 py-0.5 text-xs text-pitch-300">
          Tú
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Member {
  user_id: string;
  display_name: string;
}

interface Props {
  leagueId: string;
  userId: string;
  members: Member[];
  myPrediction: PorraPrediction | null;
  allPredictions: PorraPrediction[];
  porraResult: PorraResult | null;
  isAdmin: boolean;
}

type TabId = "mi-porra" | "clasificacion" | "admin";

// ---------------------------------------------------------------------------
// PorraView
// ---------------------------------------------------------------------------
export default function PorraView({
  leagueId,
  userId,
  members,
  myPrediction,
  allPredictions,
  porraResult,
  isAdmin,
}: Props) {
  const nameMap = useMemo(
    () => new Map(members.map((m) => [m.user_id, m.display_name])),
    [members],
  );

  // ── Prediction state ──────────────────────────────────────────────────────
  const initialItems = useMemo<string[]>(() => {
    if (myPrediction?.predictions?.length) {
      return [...myPrediction.predictions]
        .sort((a, b) => a.predicted_position - b.predicted_position)
        .map((p) => p.member_user_id);
    }
    return members.map((m) => m.user_id);
  }, [myPrediction, members]);

  const [items, setItems] = useState<string[]>(initialItems);
  const [isDirty, setIsDirty] = useState(!myPrediction);
  const [saving, setSaving] = useState(false);

  // ── Admin results state ───────────────────────────────────────────────────
  const initialAdminItems = useMemo<string[]>(() => {
    if (porraResult?.results?.length) {
      return [...porraResult.results]
        .sort((a, b) => a.real_position - b.real_position)
        .map((r) => r.member_user_id);
    }
    return members.map((m) => m.user_id);
  }, [porraResult, members]);

  const [adminItems, setAdminItems] = useState<string[]>(initialAdminItems);
  const [isFinal, setIsFinal] = useState(porraResult?.is_final ?? false);
  const [adminDirty, setAdminDirty] = useState(false);
  const [savingAdmin, setSavingAdmin] = useState(false);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const hasResults = !!porraResult?.results?.length;
  const isFinalResults = porraResult?.is_final ?? false;

  const defaultTab: TabId = hasResults ? "clasificacion" : "mi-porra";
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab);

  // ── Scores ────────────────────────────────────────────────────────────────
  const scores = useMemo(() => {
    if (!hasResults) return [];
    return computePorraScores(
      members.map((m) => ({ user_id: m.user_id, display_name: m.display_name })),
      allPredictions.map((p) => ({
        user_id: p.user_id,
        predictions: p.predictions,
      })),
      porraResult!.results,
    );
  }, [members, allPredictions, porraResult, hasResults]);

  const myScore = scores.find((s) => s.userId === userId);

  // ── Sensors ───────────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems((prev) =>
        arrayMove(prev, prev.indexOf(active.id as string), prev.indexOf(over.id as string)),
      );
      setIsDirty(true);
    }
  }

  function handleAdminDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setAdminItems((prev) =>
        arrayMove(prev, prev.indexOf(active.id as string), prev.indexOf(over.id as string)),
      );
      setAdminDirty(true);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const supabase = createClient();
      const predictions = items.map((uid, idx) => ({
        member_user_id: uid,
        predicted_position: idx + 1,
      }));
      const { error } = await supabase.rpc("save_porra_prediction", {
        p_league_id: leagueId,
        p_predictions: predictions,
      });
      if (error) throw error;
      setIsDirty(false);
    } catch (err) {
      console.error(err);
      alert("Error al guardar la predicción. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAdmin() {
    setSavingAdmin(true);
    try {
      const supabase = createClient();
      const results = adminItems.map((uid, idx) => ({
        member_user_id: uid,
        real_position: idx + 1,
      }));
      const { error } = await supabase.rpc("set_porra_results", {
        p_league_id: leagueId,
        p_results: results,
        p_is_final: isFinal,
      });
      if (error) throw error;
      setAdminDirty(false);
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert("Error al guardar los resultados. Inténtalo de nuevo.");
    } finally {
      setSavingAdmin(false);
    }
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "mi-porra", label: "Mi Porra" },
    ...(hasResults ? [{ id: "clasificacion" as TabId, label: "Clasificación" }] : []),
    ...(isAdmin ? [{ id: "admin" as TabId, label: "Resultados (admin)" }] : []),
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">La Porra</h1>
        <p className="mt-1 text-sm text-muted">
          Predice la clasificación final del fantasy. ¡Gana el más acertado!
        </p>
      </div>

      {/* Participation counter */}
      <div className="card flex flex-wrap items-center gap-3 p-3">
        <Users className="h-4 w-4 shrink-0 text-muted" />
        <span className="text-sm text-muted">
          <span className="font-semibold text-foreground">{allPredictions.length}</span> de{" "}
          <span className="font-semibold text-foreground">{members.length}</span> participantes
          han enviado su predicción
        </span>
        {isFinalResults && (
          <span className="ml-auto rounded-full bg-gold-500/20 px-2.5 py-0.5 text-xs font-semibold text-gold-300">
            Resultados definitivos
          </span>
        )}
        {hasResults && !isFinalResults && (
          <span className="ml-auto rounded-full bg-state-paused/20 px-2.5 py-0.5 text-xs font-semibold text-yellow-400">
            Resultados provisionales
          </span>
        )}
      </div>

      {/* Tab bar */}
      {tabs.length > 1 && (
        <div className="-mb-px flex gap-1 overflow-x-auto border-b border-line">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap border-b-2 px-4 py-2 font-display text-lg tracking-[0.06em] transition-colors ${
                activeTab === tab.id
                  ? "border-gold-500 text-gold-300"
                  : "border-transparent text-foreground/70 hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Tab: Mi Porra ────────────────────────────────────────────────── */}
      {activeTab === "mi-porra" && (
        <div className="space-y-4">
          {isFinalResults ? (
            <div className="card p-6 text-center">
              <Lock className="mx-auto mb-2 h-7 w-7 text-muted" />
              <p className="text-sm text-muted">
                Los resultados son definitivos. Las predicciones están cerradas.
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted">
                Arrastra los equipos para ordenarlos. La posición&nbsp;1 es el campeón previsto.
              </p>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={items} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {items.map((uid, idx) => (
                      <SortableItem
                        key={uid}
                        id={uid}
                        position={idx + 1}
                        name={nameMap.get(uid) ?? uid.slice(0, 8)}
                        isMe={uid === userId}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              <button
                onClick={handleSave}
                disabled={saving || !isDirty}
                className="btn btn-primary w-full"
              >
                {saving ? (
                  "Guardando…"
                ) : !isDirty ? (
                  <>
                    <Check className="h-4 w-4" />
                    Predicción guardada
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Guardar predicción
                  </>
                )}
              </button>

              {!isDirty && (
                <p className="text-center text-xs text-muted">
                  Puedes modificar tu predicción arrastrando los equipos y guardando de nuevo.
                </p>
              )}
            </>
          )}

          {/* My prediction breakdown (only shown when results exist) */}
          {hasResults && myScore && (
            <div className="space-y-2 pt-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">
                Tu predicción vs resultado real
              </h3>
              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-xs text-muted">
                      <th className="py-2 pl-4 text-left">Equipo</th>
                      <th className="py-2 text-center">Pred.</th>
                      <th className="py-2 text-center">Real</th>
                      <th className="py-2 text-center">Dif.</th>
                      <th className="py-2 pr-4 text-right">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myScore.details.map((d) => (
                      <tr
                        key={d.memberUserId}
                        className="border-b border-line/50 last:border-0"
                      >
                        <td className="py-2 pl-4 font-medium">{d.memberName}</td>
                        <td className="py-2 text-center text-muted">{d.predictedPosition}º</td>
                        <td className="py-2 text-center text-muted">{d.realPosition}º</td>
                        <td className="py-2 text-center text-muted">{d.difference}</td>
                        <td
                          className={`py-2 pr-4 text-right font-semibold ${
                            d.points >= 7
                              ? "text-gold-300"
                              : d.points >= 3
                                ? "text-foreground"
                                : "text-muted"
                          }`}
                        >
                          {d.points}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-line">
                      <td colSpan={4} className="py-2 pl-4 text-xs text-muted">
                        Posiciones
                      </td>
                      <td className="py-2 pr-4 text-right font-bold text-foreground">
                        {myScore.positionPoints}
                      </td>
                    </tr>
                    {myScore.bonusBreakdown.map((b) => (
                      <tr key={b.label}>
                        <td colSpan={4} className="py-1 pl-4 text-xs text-gold-400">
                          <Star className="mr-1 inline h-3 w-3" />
                          {b.label}
                        </td>
                        <td className="py-1 pr-4 text-right text-xs font-semibold text-gold-300">
                          +{b.points}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t border-line">
                      <td colSpan={4} className="py-2 pl-4 text-sm font-bold">
                        Total
                      </td>
                      <td className="py-2 pr-4 text-right text-lg font-bold text-gold-300">
                        {myScore.total}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Clasificación ───────────────────────────────────────────── */}
      {activeTab === "clasificacion" && (
        <div className="space-y-3">
          {scores.length === 0 ? (
            <div className="card p-8 text-center text-muted">
              <p className="text-sm">
                Los resultados aún no están disponibles. El admin los publicará cuando
                finalice el fantasy.
              </p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-xs text-muted">
                    <th className="py-3 pl-4 text-left">#</th>
                    <th className="py-3 text-left">Participante</th>
                    <th className="hidden py-3 text-center sm:table-cell">Posiciones</th>
                    <th className="py-3 text-center">Bonus</th>
                    <th className="py-3 pr-4 text-right font-semibold text-foreground">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {scores.map((score, idx) => (
                    <React.Fragment key={score.userId}>
                      <tr
                        className="cursor-pointer border-b border-line/50 transition-colors hover:bg-surface-2 last:border-0"
                        onClick={() =>
                          setExpandedUser(expandedUser === score.userId ? null : score.userId)
                        }
                      >
                        <td className="py-3 pl-4 w-8">
                          {idx === 0 ? (
                            <Trophy className="h-4 w-4 text-gold-400" />
                          ) : idx === 1 ? (
                            <Medal className="h-4 w-4 text-slate-400" />
                          ) : idx === 2 ? (
                            <Medal className="h-4 w-4 text-amber-700" />
                          ) : (
                            <span className="text-muted">{idx + 1}</span>
                          )}
                        </td>
                        <td className="py-3">
                          <span className="font-medium">{score.displayName}</span>
                          {score.userId === userId && (
                            <span className="ml-2 rounded-full bg-pitch-500/20 px-1.5 py-0.5 text-xs text-pitch-300">
                              Tú
                            </span>
                          )}
                        </td>
                        <td className="hidden py-3 text-center text-muted sm:table-cell">
                          {score.positionPoints}
                        </td>
                        <td className="py-3 text-center">
                          {score.bonus > 0 ? (
                            <span className="font-semibold text-gold-300">+{score.bonus}</span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="text-lg font-bold text-gold-300">
                              {score.total}
                            </span>
                            {expandedUser === score.userId ? (
                              <ChevronUp className="h-3.5 w-3.5 text-muted" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5 text-muted" />
                            )}
                          </div>
                        </td>
                      </tr>

                      {expandedUser === score.userId && (
                        <tr className="border-b border-line/50 last:border-0">
                          <td colSpan={5} className="bg-surface-2 px-4 py-3">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
                              Desglose — {score.displayName}
                            </p>
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-muted">
                                  <th className="pb-1.5 text-left">Equipo</th>
                                  <th className="pb-1.5 text-center">Pred.</th>
                                  <th className="pb-1.5 text-center">Real</th>
                                  <th className="pb-1.5 text-center">Dif.</th>
                                  <th className="pb-1.5 text-right">Pts</th>
                                </tr>
                              </thead>
                              <tbody>
                                {score.details.map((d) => (
                                  <tr
                                    key={d.memberUserId}
                                    className="border-t border-line/30"
                                  >
                                    <td className="py-1 font-medium">{d.memberName}</td>
                                    <td className="py-1 text-center text-muted">
                                      {d.predictedPosition}º
                                    </td>
                                    <td className="py-1 text-center text-muted">
                                      {d.realPosition}º
                                    </td>
                                    <td className="py-1 text-center text-muted">
                                      {d.difference}
                                    </td>
                                    <td
                                      className={`py-1 text-right font-semibold ${
                                        d.points >= 7
                                          ? "text-gold-300"
                                          : d.points >= 3
                                            ? "text-foreground"
                                            : "text-muted"
                                      }`}
                                    >
                                      {d.points}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {score.bonusBreakdown.length > 0 && (
                              <div className="mt-2 space-y-0.5">
                                {score.bonusBreakdown.map((b) => (
                                  <div
                                    key={b.label}
                                    className="flex items-center justify-between rounded bg-gold-500/10 px-2 py-1 text-xs text-gold-300"
                                  >
                                    <span>
                                      <Star className="mr-1 inline h-3 w-3" />
                                      {b.label}
                                    </span>
                                    <span className="font-bold">+{b.points}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Admin resultados ────────────────────────────────────────── */}
      {activeTab === "admin" && isAdmin && (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Establece la clasificación real del fantasy para calcular los puntos de La Porra.
            Puedes actualizarla las veces que necesites hasta marcarla como definitiva.
          </p>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleAdminDragEnd}
          >
            <SortableContext items={adminItems} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {adminItems.map((uid, idx) => (
                  <SortableItem
                    key={uid}
                    id={uid}
                    position={idx + 1}
                    name={nameMap.get(uid) ?? uid.slice(0, 8)}
                    isMe={uid === userId}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-line p-3">
            <input
              type="checkbox"
              checked={isFinal}
              onChange={(e) => {
                setIsFinal(e.target.checked);
                setAdminDirty(true);
              }}
              className="h-4 w-4 rounded border-line accent-gold-500"
            />
            <div>
              <p className="text-sm font-medium">Marcar como definitivos</p>
              <p className="text-xs text-muted">
                Bloqueará las predicciones de todos los participantes.
              </p>
            </div>
          </label>

          <button
            onClick={handleSaveAdmin}
            disabled={savingAdmin || !adminDirty}
            className="btn btn-gold w-full"
          >
            {savingAdmin ? (
              "Guardando…"
            ) : !adminDirty ? (
              <>
                <Check className="h-4 w-4" />
                Resultados guardados
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Guardar resultados
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
