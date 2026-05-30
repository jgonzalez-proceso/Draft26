"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { parseCsv, PLAYERS_CSV_EXAMPLE } from "@/lib/csv";
import type { Position } from "@/types/domain";

const POS_MAP: Record<string, Position> = {
  GK: "GK", DEF: "DEF", MID: "MID", FWD: "FWD",
  portero: "GK", defensa: "DEF", medio: "MID", delantero: "FWD",
  goalkeeper: "GK", defender: "DEF", midfielder: "MID", forward: "FWD",
};

function mapPos(v: string): Position | null {
  return POS_MAP[v.trim().toLowerCase()] ?? POS_MAP[v.trim().toUpperCase()] ?? null;
}

export default function CsvImporter() {
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  function addLog(line: string) {
    setLog((l) => [...l, line]);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLog([]);
    setBusy(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      addLog(`Leídas ${rows.length} filas.`);

      // Detecta la columna de selección (national_team / seleccion) y posición
      const teamKey = ["national_team", "seleccion", "selección", "team"].find((k) =>
        rows[0] && k in rows[0]
      );
      const posKey = ["primary_position", "posicion", "posición", "position"].find((k) =>
        rows[0] && k in rows[0]
      );
      const nameKey = ["full_name", "jugador", "nombre", "name"].find((k) =>
        rows[0] && k in rows[0]
      );
      if (!teamKey || !posKey || !nameKey) {
        addLog("⚠ El CSV debe tener columnas de nombre, selección y posición.");
        setBusy(false);
        return;
      }

      const supabase = createClient();

      // 1) Selecciones existentes
      const { data: teams } = await supabase.from("national_teams").select("id, name");
      const teamByName = new Map((teams ?? []).map((t) => [t.name.toLowerCase(), t.id]));

      // 2) Crea selecciones que falten
      const csvTeams = [...new Set(rows.map((r) => (r[teamKey] || "").trim()).filter(Boolean))];
      const missing = csvTeams.filter((t) => !teamByName.has(t.toLowerCase()));
      if (missing.length) {
        const { data: created, error } = await supabase
          .from("national_teams")
          .insert(missing.map((name) => ({ name })))
          .select("id, name");
        if (error) throw new Error(`Creando selecciones: ${error.message}`);
        (created ?? []).forEach((t) => teamByName.set(t.name.toLowerCase(), t.id));
        addLog(`Creadas ${created?.length ?? 0} selecciones nuevas.`);
      }

      // 3) Jugadores existentes (para no duplicar)
      const { data: existing } = await supabase
        .from("players")
        .select("full_name, national_team_id");
      const existingSet = new Set(
        (existing ?? []).map((p) => `${p.full_name.toLowerCase()}|${p.national_team_id}`)
      );

      // 4) Construye payload
      const payload: Record<string, unknown>[] = [];
      let skipped = 0;
      let invalid = 0;
      for (const r of rows) {
        const name = (r[nameKey] || "").trim();
        const teamId = teamByName.get((r[teamKey] || "").trim().toLowerCase());
        const pos = mapPos(r[posKey] || "");
        if (!name || !teamId || !pos) {
          invalid++;
          continue;
        }
        if (existingSet.has(`${name.toLowerCase()}|${teamId}`)) {
          skipped++;
          continue;
        }
        const sec = mapPos(r["secondary_position"] ?? r["posicion_secundaria"] ?? "");
        const ageRaw = (r["age"] ?? r["edad"] ?? "").trim();
        payload.push({
          full_name: name,
          national_team_id: teamId,
          primary_position: pos,
          secondary_position: sec,
          club: (r["club"] || "").trim() || null,
          age: ageRaw ? Number(ageRaw) || null : null,
          image_url: (r["image_url"] ?? r["imagen"] ?? "").trim() || null,
        });
      }

      // 5) Inserta en lotes
      let inserted = 0;
      for (let i = 0; i < payload.length; i += 200) {
        const chunk = payload.slice(i, i + 200);
        const { error } = await supabase.from("players").insert(chunk);
        if (error) throw new Error(`Insertando jugadores: ${error.message}`);
        inserted += chunk.length;
      }

      addLog(`✔ Importación completa: ${inserted} añadidos, ${skipped} ya existían, ${invalid} inválidos.`);
    } catch (err) {
      addLog(`✗ ${err instanceof Error ? err.message : "Error desconocido"}`);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <div className="card p-5">
      <h3 className="font-bold">Cargar jugadores (CSV)</h3>
      <p className="mt-1 text-sm text-muted">
        Columnas reconocidas: <code className="text-gold-400">nombre/full_name</code>,{" "}
        <code className="text-gold-400">selección/national_team</code>,{" "}
        <code className="text-gold-400">posición/primary_position</code> (GK/DEF/MID/FWD o
        Portero/Defensa/Medio/Delantero), y opcionales club, edad, image_url. No duplica
        jugadores existentes.
      </p>

      <label className="btn-primary mt-4 cursor-pointer">
        {busy ? "Importando…" : "Seleccionar archivo CSV"}
        <input type="file" accept=".csv,text/csv" className="hidden" disabled={busy} onChange={onFile} />
      </label>

      {log.length > 0 && (
        <pre className="mt-4 max-h-48 overflow-auto rounded-lg border border-line bg-surface-2 p-3 text-xs text-muted">
          {log.join("\n")}
        </pre>
      )}

      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-muted">Ver formato de ejemplo</summary>
        <pre className="mt-2 overflow-auto rounded-lg border border-line bg-surface-2 p-3 text-xs text-muted">
          {PLAYERS_CSV_EXAMPLE}
        </pre>
      </details>
    </div>
  );
}
