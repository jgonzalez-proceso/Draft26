// Tipos de dominio de la app de Draft del Mundial.
// Reflejan el esquema de Supabase (ver supabase/migrations).
// `database.ts` (generado con `supabase gen types`) tendrá los tipos exactos de las tablas;
// estos tipos de dominio se usan en la UI y se mantienen alineados a mano por ahora.

export type Position = "GK" | "DEF" | "MID" | "FWD";

export const POSITIONS: Position[] = ["GK", "DEF", "MID", "FWD"];

export const POSITION_LABELS: Record<Position, string> = {
  GK: "Portero",
  DEF: "Defensa",
  MID: "Medio",
  FWD: "Delantero",
};

export type PlayerStatus = "available" | "picked" | "unavailable";

export type LeagueStatus =
  | "pending_players" // Pendiente de participantes
  | "pending_draw" // Sorteo pendiente
  | "draft_active" // Draft activo
  | "draft_paused" // Draft pausado
  | "draft_finished"; // Draft finalizado

export const LEAGUE_STATUS_LABELS: Record<LeagueStatus, string> = {
  pending_players: "Pendiente de participantes",
  pending_draw: "Sorteo pendiente",
  draft_active: "Draft activo",
  draft_paused: "Draft pausado",
  draft_finished: "Draft finalizado",
};

export type DraftMode = "snake" | "linear";

export type MemberRole = "admin" | "member";

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface League {
  id: string;
  name: string;
  world_cup_year: number;
  created_by: string;
  status: LeagueStatus;
  invite_code: string;
  max_participants: number;
  created_at: string;
}

export interface LeagueMember {
  id: string;
  league_id: string;
  user_id: string;
  role: MemberRole;
  draft_order: number | null;
  joined_at: string;
}

export interface NationalTeam {
  id: string;
  name: string;
  group: string | null;
  flag_url: string | null;
  created_at: string;
}

export interface Player {
  id: string;
  full_name: string;
  national_team_id: string;
  primary_position: Position;
  secondary_position: Position | null;
  club: string | null;
  age: number | null;
  image_url: string | null;
  status: PlayerStatus;
  is_available: boolean;
  created_at: string;
}

export interface Draft {
  id: string;
  league_id: string;
  status: LeagueStatus;
  current_pick_number: number;
  current_turn_user_id: string | null;
  draft_mode: DraftMode;
  timer_enabled: boolean;
  turn_seconds: number;
  pick_deadline: string | null;
  picks_per_user: number | null;
  total_picks: number | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface DraftPick {
  id: string;
  draft_id: string;
  league_id: string;
  pick_number: number;
  user_id: string;
  player_id: string;
  is_autoskip: boolean;
  created_at: string;
}

export interface UserTeamEntry {
  id: string;
  league_id: string;
  user_id: string;
  player_id: string;
  created_at: string;
}

// Alineación guardada por (liga, usuario): formación + ids por hueco.
export interface UserLineup {
  league_id: string;
  user_id: string;
  formation: string;
  slots: (string | null)[];
}

// Jugador con datos de su selección (para listados y tarjetas).
export interface PlayerWithTeam extends Player {
  team_name: string;
  team_flag: string | null;
  team_group: string | null;
}

export const POSITION_COLORS: Record<Position, string> = {
  GK: "bg-amber-500/15 text-amber-300",
  DEF: "bg-sky-500/15 text-sky-300",
  MID: "bg-pitch-500/15 text-pitch-300",
  FWD: "bg-rose-500/15 text-rose-300",
};

// --- La Porra ---

export interface PorraPredictionEntry {
  member_user_id: string;
  predicted_position: number;
}

export interface PorraResultEntry {
  member_user_id: string;
  real_position: number;
}

export interface PorraPrediction {
  id: string;
  league_id: string;
  user_id: string;
  predictions: PorraPredictionEntry[];
  created_at: string;
  updated_at: string;
}

export interface PorraResult {
  id: string;
  league_id: string;
  results: PorraResultEntry[];
  is_final: boolean;
  created_at: string;
  updated_at: string;
}
