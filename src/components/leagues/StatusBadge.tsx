import { LEAGUE_STATUS_LABELS, type LeagueStatus } from "@/types/domain";

const STYLES: Record<LeagueStatus, string> = {
  pending_players: "bg-sky-500/15 text-sky-300 ring-1 ring-inset ring-sky-500/30",
  pending_draw: "bg-gold-500/15 text-gold-300 ring-1 ring-inset ring-gold-500/30",
  draft_active: "bg-pitch-500/15 text-pitch-300 ring-1 ring-inset ring-pitch-500/30",
  draft_paused: "bg-orange-500/15 text-orange-300 ring-1 ring-inset ring-orange-500/30",
  draft_finished: "bg-indigo-500/15 text-indigo-300 ring-1 ring-inset ring-indigo-500/30",
};

export default function StatusBadge({ status }: { status: LeagueStatus }) {
  return (
    <span className={`badge ${STYLES[status]}`}>{LEAGUE_STATUS_LABELS[status]}</span>
  );
}
