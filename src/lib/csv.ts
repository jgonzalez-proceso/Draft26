// Parser CSV minimalista (sin dependencias) con soporte de comillas dobles,
// comas dentro de comillas y saltos de línea CRLF/LF. Suficiente para la
// importación de plantillas. La cabecera define las claves de cada fila.

export type CsvRow = Record<string, string>;

export function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  // Normaliza saltos de línea y elimina BOM
  const src = text.replace(/^﻿/, "");

  for (let i = 0; i < src.length; i++) {
    const c = src[i];

    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++; // comilla escapada
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c === "\r") {
      // ignora; el \n hará el salto
    } else {
      field += c;
    }
  }
  // Última fila si no termina en salto
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (rows.length === 0) return [];

  const headers = rows[0].map((h) => h.trim());
  return rows
    .slice(1)
    .filter((r) => r.some((v) => v.trim() !== "")) // descarta líneas vacías
    .map((r) => {
      const obj: CsvRow = {};
      headers.forEach((h, idx) => {
        obj[h] = (r[idx] ?? "").trim();
      });
      return obj;
    });
}

// Plantilla CSV esperada por el importador de jugadores.
export const PLAYERS_CSV_HEADERS = [
  "full_name",
  "national_team",
  "primary_position",
  "secondary_position",
  "club",
  "age",
  "image_url",
] as const;

export const PLAYERS_CSV_EXAMPLE = `full_name,national_team,primary_position,secondary_position,club,age,image_url
Kylian Mbappé,Francia,FWD,,Real Madrid,26,
Jude Bellingham,Inglaterra,MID,,Real Madrid,21,
`;
