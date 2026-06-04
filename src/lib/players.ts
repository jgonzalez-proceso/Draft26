import type { SupabaseClient } from "@supabase/supabase-js";

// El servidor de Supabase (PostgREST "Max rows") limita cada petición a ~1000
// filas. Con 1248 jugadores hay que paginar con range() para traerlos todos;
// si no, las consultas devuelven solo los primeros 1000 (ordenados por nombre)
// y faltan ~248 jugadores en la UI.
const PLAYERS_SELECT = "*, national_teams(name, flag_url)";
const PAGE = 1000;

// Devuelve filas sin tipar (igual que las consultas PostgREST originales); las
// páginas las castean a PlayerWithTeam tras añadir team_name/team_flag.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchAllPlayers(supabase: SupabaseClient): Promise<any[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const all: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("players")
      .select(PLAYERS_SELECT)
      .order("full_name", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data?.length) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  return all;
}
