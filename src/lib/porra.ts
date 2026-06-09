import type { PorraPredictionEntry, PorraResultEntry } from "@/types/domain";

export function getPredictionPoints(
  predictedPosition: number,
  realPosition: number,
): number {
  const diff = Math.abs(predictedPosition - realPosition);
  if (diff === 0) return 10;
  if (diff === 1) return 7;
  if (diff === 2) return 5;
  if (diff === 3) return 2;
  return 0;
}

export interface PorraScoreDetail {
  memberUserId: string;
  memberName: string;
  predictedPosition: number;
  realPosition: number;
  difference: number;
  points: number;
}

export interface BonusItem {
  label: string;
  points: number;
}

export interface PorraScoreRow {
  userId: string;
  displayName: string;
  positionPoints: number;
  bonus: number;
  bonusBreakdown: BonusItem[];
  total: number;
  details: PorraScoreDetail[];
}

export function computePorraScores(
  members: Array<{ user_id: string; display_name: string }>,
  predictions: Array<{ user_id: string; predictions: PorraPredictionEntry[] }>,
  results: PorraResultEntry[],
): PorraScoreRow[] {
  if (results.length === 0) return [];

  const n = results.length;
  const realMap = new Map(results.map((r) => [r.member_user_id, r.real_position]));
  const nameMap = new Map(members.map((m) => [m.user_id, m.display_name]));

  const sorted = [...results].sort((a, b) => a.real_position - b.real_position);
  const realFirst = sorted[0]?.member_user_id;
  const realSecond = sorted[1]?.member_user_id;
  const realThird = sorted[2]?.member_user_id;
  const realLast = sorted[n - 1]?.member_user_id;

  return predictions
    .map(({ user_id, predictions: preds }) => {
      let positionPoints = 0;
      const details: PorraScoreDetail[] = [];

      for (const p of preds) {
        const realPos = realMap.get(p.member_user_id);
        if (realPos === undefined) continue;
        const pts = getPredictionPoints(p.predicted_position, realPos);
        positionPoints += pts;
        details.push({
          memberUserId: p.member_user_id,
          memberName: nameMap.get(p.member_user_id) ?? "?",
          predictedPosition: p.predicted_position,
          realPosition: realPos,
          difference: Math.abs(p.predicted_position - realPos),
          points: pts,
        });
      }
      details.sort((a, b) => a.predictedPosition - b.predictedPosition);

      const byPos = new Map(preds.map((p) => [p.predicted_position, p.member_user_id]));
      const predFirst = byPos.get(1);
      const predSecond = byPos.get(2);
      const predThird = byPos.get(3);
      const predLast = byPos.get(n);

      let bonus = 0;
      const bonusBreakdown: BonusItem[] = [];

      if (predFirst && predFirst === realFirst) {
        bonus += 5;
        bonusBreakdown.push({ label: "Campeón exacto", points: 5 });
      }
      if (predLast && predLast === realLast) {
        bonus += 3;
        bonusBreakdown.push({ label: "Último clasificado exacto", points: 3 });
      }

      const exactPodium =
        predFirst === realFirst &&
        predSecond === realSecond &&
        predThird === realThird;

      const samePodium =
        [predFirst, predSecond, predThird].every(
          (id) => id !== undefined && [realFirst, realSecond, realThird].includes(id),
        );

      if (exactPodium) {
        bonus += 15;
        bonusBreakdown.push({ label: "Podio exacto en orden", points: 15 });
      } else if (samePodium) {
        bonus += 8;
        bonusBreakdown.push({ label: "Equipos del podio acertados", points: 8 });
      }

      return {
        userId: user_id,
        displayName: nameMap.get(user_id) ?? "?",
        positionPoints,
        bonus,
        bonusBreakdown,
        total: positionPoints + bonus,
        details,
      };
    })
    .sort((a, b) => b.total - a.total);
}
