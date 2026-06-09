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
  Eye,
  Info,
  X,
  Beer,
  Trash2,
  RotateCcw,
  History,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { PorraPrediction, PorraResult, PorraResultEntry, PorraResultSnapshot } from "@/types/domain";
import { computePorraScores, type PorraScoreRow } from "@/lib/porra";

// ---------------------------------------------------------------------------
// SortableItem
// ---------------------------------------------------------------------------
function SortableItem({
  id,
  position,
  name,
  isMe,
}: {
  id: string;
  position: number;
  name: string;
  isMe: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

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
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-muted active:cursor-grabbing"
        aria-label="Arrastrar para reordenar"
      >
        <GripVertical className="h-5 w-5" />
      </button>
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
// StaticPredictionList  (read-only, no DnD)
// ---------------------------------------------------------------------------
function StaticPredictionList({
  orderedIds,
  nameMap,
  userId,
}: {
  orderedIds: string[];
  nameMap: Map<string, string>;
  userId: string;
}) {
  return (
    <div className="space-y-2">
      {orderedIds.map((uid, idx) => (
        <div key={uid} className="card flex items-center gap-3 p-3">
          <span className="w-7 shrink-0 text-center font-display text-xl leading-none text-gold-400">
            {idx + 1}
          </span>
          <span className="w-5 shrink-0">
            {idx === 0 && <Trophy className="h-4 w-4 text-gold-400" />}
            {idx === 1 && <Medal className="h-4 w-4 text-slate-400" />}
            {idx === 2 && <Medal className="h-4 w-4 text-amber-700" />}
          </span>
          <span className="flex-1 font-medium leading-tight">
            {nameMap.get(uid) ?? uid.slice(0, 8)}
          </span>
          {uid === userId && (
            <span className="rounded-full bg-pitch-500/20 px-2 py-0.5 text-xs text-pitch-300">
              Tú
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MiniLeaderboard  (live preview in admin tab)
// ---------------------------------------------------------------------------
function MiniLeaderboard({ rows, userId }: { rows: PorraScoreRow[]; userId: string }) {
  if (rows.length === 0)
    return (
      <p className="py-4 text-center text-xs text-muted">
        Aún no hay predicciones enviadas.
      </p>
    );
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-xs text-muted">
          <th className="pb-2 pl-2 text-left">#</th>
          <th className="pb-2 text-left">Participante</th>
          <th className="pb-2 text-center">Pos.</th>
          <th className="pb-2 text-center">Bonus</th>
          <th className="pb-2 pr-2 text-right font-semibold text-foreground">Total</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => (
          <tr key={row.userId} className="border-b border-line/40 last:border-0">
            <td className="py-1.5 pl-2 w-6">
              {idx === 0 ? (
                <Trophy className="h-3.5 w-3.5 text-gold-400" />
              ) : idx === 1 ? (
                <Medal className="h-3.5 w-3.5 text-slate-400" />
              ) : idx === 2 ? (
                <Medal className="h-3.5 w-3.5 text-amber-700" />
              ) : (
                <span className="text-xs text-muted">{idx + 1}</span>
              )}
            </td>
            <td className="py-1.5">
              <span className={row.userId === userId ? "font-semibold text-pitch-300" : ""}>
                {row.displayName}
              </span>
            </td>
            <td className="py-1.5 text-center text-xs text-muted">{row.positionPoints}</td>
            <td className="py-1.5 text-center text-xs">
              {row.bonus > 0 ? (
                <span className="text-gold-300">+{row.bonus}</span>
              ) : (
                <span className="text-muted">—</span>
              )}
            </td>
            <td className="py-1.5 pr-2 text-right font-bold text-gold-300">{row.total}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// ScoringGuide  (puntuaciones + premio)
// ---------------------------------------------------------------------------
function ScoringGuide({ onClose }: { onClose: () => void }) {
  return (
    <div className="card space-y-5 p-5">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-xl font-bold">Sistema de puntuación</h2>
        <button onClick={onClose} className="text-muted hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Position points */}
      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted">
          Puntos por posición
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[
            { diff: "Exacta", pts: 10, color: "text-gold-300 bg-gold-500/10" },
            { diff: "±1 posición", pts: 7, color: "text-green-300 bg-green-500/10" },
            { diff: "±2 posiciones", pts: 5, color: "text-green-300 bg-green-500/10" },
            { diff: "±3 posiciones", pts: 2, color: "text-foreground bg-surface-2" },
            { diff: "±4 o más", pts: 0, color: "text-muted bg-surface-2" },
          ].map(({ diff, pts, color }) => (
            <div key={diff} className={`rounded-lg px-3 py-2 ${color}`}>
              <p className="text-xs opacity-70">{diff}</p>
              <p className="text-lg font-bold leading-tight">{pts} pts</p>
            </div>
          ))}
        </div>
      </div>

      {/* Bonuses */}
      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted">
          Bonus especiales
        </h3>
        <div className="space-y-2">
          {[
            { label: "Acertar el campeón exacto", pts: "+5" },
            { label: "Acertar el último clasificado exacto", pts: "+3" },
            { label: "Acertar los 3 del podio (en cualquier orden)", pts: "+8" },
            {
              label: "Acertar el podio exacto y en orden (reemplaza al anterior)",
              pts: "+15",
              highlight: true,
            },
          ].map(({ label, pts, highlight }) => (
            <div
              key={label}
              className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 ${
                highlight ? "bg-gold-500/10" : "bg-surface-2"
              }`}
            >
              <span className={`text-sm ${highlight ? "font-medium text-gold-200" : ""}`}>
                <Star className="mr-1.5 inline h-3.5 w-3.5 text-gold-400" />
                {label}
              </span>
              <span className="shrink-0 font-bold text-gold-300">{pts}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Prize */}
      <div className="rounded-xl border border-gold-500/40 bg-gold-500/5 p-4 text-center">
        <Beer className="mx-auto mb-2 h-8 w-8 text-gold-400" />
        <p className="text-sm font-semibold uppercase tracking-wider text-muted">Premio</p>
        <p className="mt-1 text-lg font-bold text-gold-300">
          El ganador será invitado por los demás al Claxón
        </p>
      </div>
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
  initialPorraResult: PorraResult | null;
  initialSnapshots: PorraResultSnapshot[];
  isAdmin: boolean;
}

type TabId = "mi-porra" | "predicciones" | "clasificacion" | "admin";

// ---------------------------------------------------------------------------
// PorraView
// ---------------------------------------------------------------------------
export default function PorraView({
  leagueId,
  userId,
  members,
  myPrediction,
  allPredictions: initialAllPredictions,
  initialPorraResult,
  initialSnapshots,
  isAdmin,
}: Props) {
  const nameMap = useMemo(
    () => new Map(members.map((m) => [m.user_id, m.display_name])),
    [members],
  );

  // ── All predictions (local state so we can add mine after saving) ─────────
  const [predictions, setPredictions] = useState<PorraPrediction[]>(initialAllPredictions);

  // ── Prediction form state ─────────────────────────────────────────────────
  const initialItems = useMemo<string[]>(() => {
    if (myPrediction?.predictions?.length) {
      return [...myPrediction.predictions]
        .sort((a, b) => a.predicted_position - b.predicted_position)
        .map((p) => p.member_user_id);
    }
    return members.map((m) => m.user_id);
  }, [myPrediction, members]);

  const [items, setItems] = useState<string[]>(initialItems);
  const [isLocked, setIsLocked] = useState(!!myPrediction);
  const [isDirty, setIsDirty] = useState(!myPrediction);
  const [saving, setSaving] = useState(false);

  // ── Admin results state ───────────────────────────────────────────────────
  const [porraResult, setPorraResult] = useState<PorraResult | null>(initialPorraResult);

  const initialAdminItems = useMemo<string[]>(() => {
    if (initialPorraResult?.results?.length) {
      return [...initialPorraResult.results]
        .sort((a, b) => a.real_position - b.real_position)
        .map((r) => r.member_user_id);
    }
    return members.map((m) => m.user_id);
  }, [initialPorraResult, members]);

  const [adminItems, setAdminItems] = useState<string[]>(initialAdminItems);
  const [isFinal, setIsFinal] = useState(initialPorraResult?.is_final ?? false);
  const [adminDirty, setAdminDirty] = useState(!initialPorraResult?.results?.length);
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [snapshotLabel, setSnapshotLabel] = useState("");
  const [localSnapshots, setLocalSnapshots] = useState<PorraResultSnapshot[]>(initialSnapshots);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [showScoring, setShowScoring] = useState(false);

  // ── Derived ───────────────────────────────────────────────────────────────
  const hasResults = !!porraResult?.results?.length;
  const isFinalResults = porraResult?.is_final ?? false;

  const defaultTab: TabId = hasResults
    ? "clasificacion"
    : isAdmin
      ? "admin"
      : "mi-porra";
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab);

  // ── Scores from saved porraResult ─────────────────────────────────────────
  const scores = useMemo(() => {
    if (!hasResults) return [];
    return computePorraScores(
      members.map((m) => ({ user_id: m.user_id, display_name: m.display_name })),
      predictions.map((p) => ({ user_id: p.user_id, predictions: p.predictions })),
      porraResult!.results,
    );
  }, [members, predictions, porraResult, hasResults]);

  // ── Live preview scores (real-time from adminItems) ───────────────────────
  const liveScores = useMemo<PorraScoreRow[]>(() => {
    if (!predictions.length) return [];
    const liveResults: PorraResultEntry[] = adminItems.map((uid, idx) => ({
      member_user_id: uid,
      real_position: idx + 1,
    }));
    return computePorraScores(
      members.map((m) => ({ user_id: m.user_id, display_name: m.display_name })),
      predictions.map((p) => ({ user_id: p.user_id, predictions: p.predictions })),
      liveResults,
    );
  }, [adminItems, predictions, members]);

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
      const preds = items.map((uid, idx) => ({
        member_user_id: uid,
        predicted_position: idx + 1,
      }));
      const { error } = await supabase.rpc("save_porra_prediction", {
        p_league_id: leagueId,
        p_predictions: preds,
      });
      if (error) throw error;
      // Lock the form and add to local predictions list
      setIsLocked(true);
      setIsDirty(false);
      const newPred: PorraPrediction = {
        id: crypto.randomUUID(),
        league_id: leagueId,
        user_id: userId,
        predictions: preds,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setPredictions((prev) => [...prev.filter((p) => p.user_id !== userId), newPred]);
      // Jump to see everyone's predictions
      setActiveTab("predicciones");
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
      const results: PorraResultEntry[] = adminItems.map((uid, idx) => ({
        member_user_id: uid,
        real_position: idx + 1,
      }));
      const { error } = await supabase.rpc("set_porra_results", {
        p_league_id: leagueId,
        p_results: results,
        p_is_final: isFinal,
        p_label: snapshotLabel.trim(),
      });
      if (error) throw error;
      const now = new Date().toISOString();
      setPorraResult((prev) => ({
        id: prev?.id ?? crypto.randomUUID(),
        league_id: leagueId,
        results,
        is_final: isFinal,
        created_at: prev?.created_at ?? now,
        updated_at: now,
      }));
      const autoLabel = snapshotLabel.trim() ||
        new Date().toLocaleString("es-ES", {
          day: "2-digit", month: "2-digit", year: "numeric",
          hour: "2-digit", minute: "2-digit",
        });
      setLocalSnapshots((prev) => [
        { id: crypto.randomUUID(), league_id: leagueId, results, label: autoLabel, created_at: now },
        ...prev,
      ]);
      setSnapshotLabel("");
      setAdminDirty(false);
      setActiveTab("clasificacion");
    } catch (err) {
      console.error(err);
      alert("Error al guardar los resultados. Inténtalo de nuevo.");
    } finally {
      setSavingAdmin(false);
    }
  }

  function handleLoadSnapshot(snap: PorraResultSnapshot) {
    const orderedIds = [...snap.results]
      .sort((a, b) => a.real_position - b.real_position)
      .map((r) => r.member_user_id);
    setAdminItems(orderedIds);
    setSnapshotLabel(snap.label);
    setAdminDirty(true);
  }

  async function handleDeleteSnapshot(snapshotId: string) {
    setDeletingId(snapshotId);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("delete_porra_snapshot", {
        p_snapshot_id: snapshotId,
      });
      if (error) throw error;
      setLocalSnapshots((prev) => prev.filter((s) => s.id !== snapshotId));
    } catch (err) {
      console.error(err);
      alert("Error al eliminar el snapshot. Inténtalo de nuevo.");
    } finally {
      setDeletingId(null);
    }
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "mi-porra", label: "Mi Porra" },
    // "Predicciones" visible once user has submitted their own
    ...(isLocked ? [{ id: "predicciones" as TabId, label: "Predicciones" }] : []),
    ...(hasResults || isAdmin ? [{ id: "clasificacion" as TabId, label: "Clasificación" }] : []),
    ...(isAdmin ? [{ id: "admin" as TabId, label: "Resultados (admin)" }] : []),
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">La Porra</h1>
          <p className="mt-1 text-sm text-muted">
            Predice la clasificación final del fantasy. ¡Gana el más acertado!
          </p>
        </div>
        <button
          onClick={() => setShowScoring((v) => !v)}
          className="btn btn-ghost flex items-center gap-2 text-sm"
        >
          <Info className="h-4 w-4" />
          Puntuaciones
        </button>
      </div>

      {/* Scoring guide (toggle) */}
      {showScoring && <ScoringGuide onClose={() => setShowScoring(false)} />}

      {/* Participation + status */}
      <div className="card flex flex-wrap items-center gap-3 p-3">
        <Users className="h-4 w-4 shrink-0 text-muted" />
        <span className="text-sm text-muted">
          <span className="font-semibold text-foreground">{predictions.length}</span> de{" "}
          <span className="font-semibold text-foreground">{members.length}</span> participantes
          han enviado su predicción
        </span>
        {isFinalResults && (
          <span className="ml-auto rounded-full bg-gold-500/20 px-2.5 py-0.5 text-xs font-semibold text-gold-300">
            Resultados definitivos
          </span>
        )}
        {hasResults && !isFinalResults && (
          <span className="ml-auto rounded-full bg-yellow-500/20 px-2.5 py-0.5 text-xs font-semibold text-yellow-400">
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
              {tab.id === "admin" && adminDirty && (
                <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-gold-400 align-middle" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Tab: Mi Porra ────────────────────────────────────────────────── */}
      {activeTab === "mi-porra" && (
        <div className="space-y-4">
          {isLocked || isFinalResults ? (
            <div className="space-y-3">
              {/* Lock notice */}
              <div className="card flex items-center gap-3 p-3">
                <Lock className="h-4 w-4 shrink-0 text-gold-400" />
                <p className="text-sm">
                  {isFinalResults
                    ? "Los resultados son definitivos. Las predicciones están cerradas."
                    : "Tu predicción ha sido enviada y no puede modificarse."}
                </p>
                {isLocked && !isFinalResults && (
                  <button
                    onClick={() => setActiveTab("predicciones")}
                    className="btn btn-ghost ml-auto text-xs"
                  >
                    Ver todas
                  </button>
                )}
              </div>
              {/* Read-only list */}
              <StaticPredictionList
                orderedIds={items}
                nameMap={nameMap}
                userId={userId}
              />
            </div>
          ) : (
            <>
              <p className="text-sm text-muted">
                Arrastra los equipos para ordenarlos. La posición&nbsp;1 es el campeón previsto.{" "}
                <strong className="text-foreground">
                  Una vez enviada, la predicción no puede modificarse.
                </strong>
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
                    Sin cambios
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Enviar predicción
                  </>
                )}
              </button>
            </>
          )}

          {/* My breakdown vs official results */}
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
                      <tr key={d.memberUserId} className="border-b border-line/50 last:border-0">
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
                      <td className="py-2 pr-4 text-right font-bold">{myScore.positionPoints}</td>
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

      {/* ── Tab: Predicciones ────────────────────────────────────────────── */}
      {activeTab === "predicciones" && (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Predicciones enviadas por los participantes.
            {predictions.length < members.length && (
              <span className="ml-1 text-yellow-400">
                Aún faltan {members.length - predictions.length} por enviar.
              </span>
            )}
          </p>
          {predictions.length === 0 ? (
            <div className="card p-8 text-center text-muted">
              <p className="text-sm">Nadie ha enviado su predicción todavía.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {predictions.map((pred) => {
                const sorted = [...pred.predictions].sort(
                  (a, b) => a.predicted_position - b.predicted_position,
                );
                const predictorName = nameMap.get(pred.user_id) ?? pred.user_id.slice(0, 8);
                const isOwn = pred.user_id === userId;
                return (
                  <div
                    key={pred.user_id}
                    className={`card p-4 ${isOwn ? "ring-1 ring-pitch-500/40" : ""}`}
                  >
                    {/* Card header */}
                    <div className="mb-3 flex items-center gap-2.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pitch-500/20 text-sm font-bold text-pitch-300">
                        {predictorName.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold leading-tight">{predictorName}</p>
                        {isOwn && (
                          <p className="text-xs text-pitch-300">Tu predicción</p>
                        )}
                      </div>
                    </div>
                    {/* Ordered list */}
                    <ol className="space-y-1.5">
                      {sorted.map((p, idx) => (
                        <li key={p.member_user_id} className="flex items-center gap-2 text-sm">
                          <span className="w-5 shrink-0 text-center font-display text-base leading-none text-gold-400">
                            {idx + 1}
                          </span>
                          <span className="w-4 shrink-0">
                            {idx === 0 && <Trophy className="h-3.5 w-3.5 text-gold-400" />}
                            {idx === 1 && <Medal className="h-3.5 w-3.5 text-slate-400" />}
                            {idx === 2 && <Medal className="h-3.5 w-3.5 text-amber-700" />}
                          </span>
                          <span
                            className={
                              p.member_user_id === userId
                                ? "font-semibold text-pitch-300"
                                : ""
                            }
                          >
                            {nameMap.get(p.member_user_id) ?? "?"}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Clasificación ───────────────────────────────────────────── */}
      {activeTab === "clasificacion" && (
        <div className="space-y-3">
          {scores.length === 0 ? (
            <div className="card p-8 text-center">
              <Eye className="mx-auto mb-3 h-8 w-8 text-muted" />
              <p className="font-medium">Sin resultados publicados todavía</p>
              <p className="mt-1 text-sm text-muted">
                {isAdmin
                  ? "Ve al tab «Resultados (admin)», introduce la clasificación actual y guarda."
                  : "El admin publicará la clasificación cuando haya resultados."}
              </p>
              {isAdmin && (
                <button
                  onClick={() => setActiveTab("admin")}
                  className="btn btn-gold mx-auto mt-4"
                >
                  Introducir clasificación
                </button>
              )}
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
                        <td className="w-8 py-3 pl-4">
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
                            <span className="text-lg font-bold text-gold-300">{score.total}</span>
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
                                  <tr key={d.memberUserId} className="border-t border-line/30">
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

      {/* ── Tab: Resultados (admin) ──────────────────────────────────────── */}
      {activeTab === "admin" && isAdmin && (
        <div className="space-y-5">
          <p className="text-sm text-muted">
            Introduce la clasificación actual del fantasy arrastrando los equipos. La previsión
            de puntos se actualiza en tiempo real. Guarda cuando quieras publicar los resultados.
          </p>

          <div className="grid gap-5 sm:grid-cols-2">
            {/* Left: drag & drop */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">
                Clasificación del fantasy
              </h3>
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
            </div>

            {/* Right: live porra preview */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">
                Previsión de la porra
                <span className="ml-2 rounded bg-pitch-500/20 px-1.5 py-0.5 text-xs font-normal normal-case text-pitch-300">
                  en tiempo real
                </span>
              </h3>
              <div className="card overflow-hidden p-2">
                <MiniLeaderboard rows={liveScores} userId={userId} />
              </div>
            </div>
          </div>

          {/* Label input + final checkbox + save */}
          <div className="space-y-3 rounded-xl border border-line p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              Guardar clasificación
            </p>
            <input
              type="text"
              placeholder="Etiqueta (ej. Jornada 5)"
              value={snapshotLabel}
              onChange={(e) => setSnapshotLabel(e.target.value)}
              className="input w-full"
            />
            <label className="flex cursor-pointer items-center gap-3">
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
                <p className="text-sm font-medium">Resultados definitivos</p>
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
                  Clasificación guardada
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Guardar y ver porra
                </>
              )}
            </button>
          </div>

          {/* Snapshot history */}
          {localSnapshots.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-muted" />
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">
                  Historial de clasificaciones
                </h3>
              </div>
              <div className="space-y-2">
                {localSnapshots.map((snap) => {
                  const top3 = [...snap.results]
                    .sort((a, b) => a.real_position - b.real_position)
                    .slice(0, 3)
                    .map((r) => nameMap.get(r.member_user_id)?.split(" ")[0] ?? "?");
                  return (
                    <div
                      key={snap.id}
                      className="card flex flex-wrap items-center gap-3 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{snap.label}</p>
                        <p className="text-xs text-muted">
                          {top3.map((n, i) => (
                            <span key={i}>
                              {i > 0 && " · "}
                              <span className="text-gold-400">{i + 1}.</span> {n}
                            </span>
                          ))}
                        </p>
                      </div>
                      <button
                        onClick={() => handleLoadSnapshot(snap)}
                        title="Cargar en el formulario"
                        className="btn btn-ghost flex items-center gap-1.5 text-xs"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Cargar
                      </button>
                      <button
                        onClick={() => handleDeleteSnapshot(snap.id)}
                        disabled={deletingId === snap.id}
                        title="Eliminar snapshot"
                        className="text-muted transition-colors hover:text-red-400 disabled:opacity-40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
