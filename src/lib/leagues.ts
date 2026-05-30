import { createClient } from "@/lib/supabase/server";
import type { Draft, League, LeagueMember, MemberRole } from "@/types/domain";

export interface MemberWithProfile extends LeagueMember {
  profiles: { display_name: string | null; avatar_url: string | null } | null;
}

export interface LeagueContext {
  userId: string;
  league: League;
  draft: Draft | null;
  members: MemberWithProfile[];
  role: MemberRole;
  isAdmin: boolean;
}

// Carga el contexto de una liga para el usuario actual. Devuelve null si no es
// miembro (RLS impide ver la liga) o no existe.
export async function getLeagueContext(
  leagueId: string
): Promise<LeagueContext | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: league } = await supabase
    .from("leagues")
    .select("*")
    .eq("id", leagueId)
    .single();
  if (!league) return null;

  const { data: members } = await supabase
    .from("league_members")
    .select("*, profiles(display_name, avatar_url)")
    .eq("league_id", leagueId)
    .order("draft_order", { ascending: true, nullsFirst: false })
    .order("joined_at", { ascending: true });

  const { data: draft } = await supabase
    .from("drafts")
    .select("*")
    .eq("league_id", leagueId)
    .single();

  const me = (members ?? []).find((m) => m.user_id === user.id);
  if (!me) return null; // no es miembro

  return {
    userId: user.id,
    league: league as League,
    draft: (draft as Draft) ?? null,
    members: (members ?? []) as MemberWithProfile[],
    role: me.role as MemberRole,
    isAdmin: me.role === "admin",
  };
}

// Lista de ligas del usuario con su rol.
export async function getMyLeagues() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("league_members")
    .select("role, draft_order, leagues(*)")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false });

  return (data ?? [])
    .map((row) => ({
      role: row.role as MemberRole,
      league: (Array.isArray(row.leagues) ? row.leagues[0] : row.leagues) as League | null,
    }))
    .filter((r): r is { role: MemberRole; league: League } => !!r.league);
}
