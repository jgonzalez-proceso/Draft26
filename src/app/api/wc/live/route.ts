import { NextResponse } from "next/server";
import { getEspnGoals, getEspnScoreboard } from "@/lib/espnFootball";
import { wcN8nHasData, getWcEventsFromDb } from "@/lib/wcSupabaseResults";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const fixture = searchParams.get("fixture");

  // Goleadores de un partido concreto
  if (fixture) {
    // Si N8N está activo leer de Supabase; si no, llamar a ESPN
    const goals = (await wcN8nHasData())
      ? await getWcEventsFromDb(fixture)
      : await getEspnGoals(fixture);
    return NextResponse.json({ goals });
  }

  // Partidos en vivo
  const live = await getEspnScoreboard();
  return NextResponse.json({ fixtures: live.filter((f) => f.statusShort === "in") });
}
