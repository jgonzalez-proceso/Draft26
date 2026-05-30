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
