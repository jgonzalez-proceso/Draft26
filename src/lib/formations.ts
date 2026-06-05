import type { PlayerWithTeam, Position } from "@/types/domain";

// Formaciones clásicas: [defensas, medios, delanteros] (el portero es siempre 1).
export const FORMATIONS: Record<string, [number, number, number]> = {
  "4-3-3": [4, 3, 3],
  "4-4-2": [4, 4, 2],
  "4-2-3-1": [4, 5, 1], // 5 medios en una línea (simplificado)
  "3-5-2": [3, 5, 2],
  "5-3-2": [5, 3, 2],
  "3-4-3": [3, 4, 3],
  "4-5-1": [4, 5, 1],
};

export const DEFAULT_FORMATION = "4-3-3";

export interface Slot {
  pos: Position;
  x: number; // 0 (portería propia, izq) → 100 (ataque, der)
  y: number; // 0 (arriba) → 100 (abajo)
}

// Genera las posiciones de los 11 huecos en el campo (orientación horizontal).
export function formationSlots(name: string): Slot[] {
  const [def, mid, fwd] = FORMATIONS[name] ?? FORMATIONS[DEFAULT_FORMATION];
  const slots: Slot[] = [{ pos: "GK", x: 8, y: 50 }];
  const line = (count: number, x: number, pos: Position) => {
    for (let i = 0; i < count; i++) {
      slots.push({ pos, x, y: ((i + 1) * 100) / (count + 1) });
    }
  };
  line(def, 30, "DEF");
  line(mid, 54, "MID");
  line(fwd, 76, "FWD");
  return slots;
}

export interface PlacedSlot {
  slot: Slot;
  player: PlayerWithTeam | null;
}

// Reparte la plantilla del usuario en los huecos de la formación (por posición
// principal). Los excedentes y los que no caben van al banquillo.
export function assignSquad(
  squad: PlayerWithTeam[],
  formation: string
): { lineup: PlacedSlot[]; bench: PlayerWithTeam[] } {
  const queues: Record<Position, PlayerWithTeam[]> = { GK: [], DEF: [], MID: [], FWD: [] };
  for (const p of squad) queues[p.primary_position].push(p);

  const lineup = formationSlots(formation).map((slot) => ({
    slot,
    player: queues[slot.pos].shift() ?? null,
  }));

  const bench = [...queues.GK, ...queues.DEF, ...queues.MID, ...queues.FWD];
  return { lineup, bench };
}

// Ids de jugador por hueco (longitud = nº de huecos de la formación) según la
// asignación automática. Sirve de punto de partida cuando no hay alineación guardada.
export function autoSlotIds(squad: PlayerWithTeam[], formation: string): (string | null)[] {
  return assignSquad(squad, formation).lineup.map((pl) => pl.player?.id ?? null);
}

// Construye la alineación a partir de ids por hueco (colocación manual / guardada).
// Cualquier jugador puede ir en cualquier hueco; los ids que ya no están en la
// plantilla se ignoran. El banquillo es la plantilla menos los colocados.
export function buildLineupFromIds(
  squad: PlayerWithTeam[],
  formation: string,
  ids: (string | null)[]
): { lineup: PlacedSlot[]; bench: PlayerWithTeam[] } {
  const byId = new Map(squad.map((p) => [p.id, p]));
  const lineup = formationSlots(formation).map((slot, i) => ({
    slot,
    player: ids[i] ? byId.get(ids[i] as string) ?? null : null,
  }));
  const placed = new Set(lineup.map((pl) => pl.player?.id).filter(Boolean) as string[]);
  const bench = squad.filter((p) => !placed.has(p.id));
  return { lineup, bench };
}
