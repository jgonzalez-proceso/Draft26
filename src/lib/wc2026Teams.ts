/**
 * Fuente autoritativa de los 48 equipos del Mundial 2026 y su grupo,
 * según el sorteo final FIFA (5-dic-2025).
 *
 * `nameEs` coincide exactamente con los nombres de `national_teams` (seed.sql)
 * para los 32 equipos que ya tienen plantilla, de modo que se fusionan por
 * nombre. Los 16 restantes aún no tienen plantilla → "pendiente de cargar".
 */

export interface Wc2026Team {
  id: string;       // ISO-2 (o gb-eng / gb-sct)
  nameEs: string;
  group: string;    // "A" … "L"
  flagUrl: string;
}

const flag = (iso: string) => `https://flagcdn.com/w320/${iso}.png`;

export const WC2026_TEAMS: Wc2026Team[] = [
  // Grupo A
  { id: "mx", nameEs: "México", group: "A", flagUrl: flag("mx") },
  { id: "za", nameEs: "Sudáfrica", group: "A", flagUrl: flag("za") },
  { id: "kr", nameEs: "Corea del Sur", group: "A", flagUrl: flag("kr") },
  { id: "cz", nameEs: "Chequia", group: "A", flagUrl: flag("cz") },
  // Grupo B
  { id: "ca", nameEs: "Canadá", group: "B", flagUrl: flag("ca") },
  { id: "ba", nameEs: "Bosnia y Herzegovina", group: "B", flagUrl: flag("ba") },
  { id: "qa", nameEs: "Catar", group: "B", flagUrl: flag("qa") },
  { id: "ch", nameEs: "Suiza", group: "B", flagUrl: flag("ch") },
  // Grupo C
  { id: "br", nameEs: "Brasil", group: "C", flagUrl: flag("br") },
  { id: "ma", nameEs: "Marruecos", group: "C", flagUrl: flag("ma") },
  { id: "ht", nameEs: "Haití", group: "C", flagUrl: flag("ht") },
  { id: "gb-sct", nameEs: "Escocia", group: "C", flagUrl: flag("gb-sct") },
  // Grupo D
  { id: "us", nameEs: "Estados Unidos", group: "D", flagUrl: flag("us") },
  { id: "py", nameEs: "Paraguay", group: "D", flagUrl: flag("py") },
  { id: "au", nameEs: "Australia", group: "D", flagUrl: flag("au") },
  { id: "tr", nameEs: "Turquía", group: "D", flagUrl: flag("tr") },
  // Grupo E
  { id: "de", nameEs: "Alemania", group: "E", flagUrl: flag("de") },
  { id: "cw", nameEs: "Curazao", group: "E", flagUrl: flag("cw") },
  { id: "ci", nameEs: "Costa de Marfil", group: "E", flagUrl: flag("ci") },
  { id: "ec", nameEs: "Ecuador", group: "E", flagUrl: flag("ec") },
  // Grupo F
  { id: "nl", nameEs: "Países Bajos", group: "F", flagUrl: flag("nl") },
  { id: "jp", nameEs: "Japón", group: "F", flagUrl: flag("jp") },
  { id: "se", nameEs: "Suecia", group: "F", flagUrl: flag("se") },
  { id: "tn", nameEs: "Túnez", group: "F", flagUrl: flag("tn") },
  // Grupo G
  { id: "be", nameEs: "Bélgica", group: "G", flagUrl: flag("be") },
  { id: "eg", nameEs: "Egipto", group: "G", flagUrl: flag("eg") },
  { id: "ir", nameEs: "Irán", group: "G", flagUrl: flag("ir") },
  { id: "nz", nameEs: "Nueva Zelanda", group: "G", flagUrl: flag("nz") },
  // Grupo H
  { id: "es", nameEs: "España", group: "H", flagUrl: flag("es") },
  { id: "cv", nameEs: "Cabo Verde", group: "H", flagUrl: flag("cv") },
  { id: "sa", nameEs: "Arabia Saudí", group: "H", flagUrl: flag("sa") },
  { id: "uy", nameEs: "Uruguay", group: "H", flagUrl: flag("uy") },
  // Grupo I
  { id: "fr", nameEs: "Francia", group: "I", flagUrl: flag("fr") },
  { id: "sn", nameEs: "Senegal", group: "I", flagUrl: flag("sn") },
  { id: "iq", nameEs: "Irak", group: "I", flagUrl: flag("iq") },
  { id: "no", nameEs: "Noruega", group: "I", flagUrl: flag("no") },
  // Grupo J
  { id: "ar", nameEs: "Argentina", group: "J", flagUrl: flag("ar") },
  { id: "dz", nameEs: "Argelia", group: "J", flagUrl: flag("dz") },
  { id: "at", nameEs: "Austria", group: "J", flagUrl: flag("at") },
  { id: "jo", nameEs: "Jordania", group: "J", flagUrl: flag("jo") },
  // Grupo K
  { id: "pt", nameEs: "Portugal", group: "K", flagUrl: flag("pt") },
  { id: "cd", nameEs: "República Democrática del Congo", group: "K", flagUrl: flag("cd") },
  { id: "uz", nameEs: "Uzbekistán", group: "K", flagUrl: flag("uz") },
  { id: "co", nameEs: "Colombia", group: "K", flagUrl: flag("co") },
  // Grupo L
  { id: "gb-eng", nameEs: "Inglaterra", group: "L", flagUrl: flag("gb-eng") },
  { id: "hr", nameEs: "Croacia", group: "L", flagUrl: flag("hr") },
  { id: "gh", nameEs: "Ghana", group: "L", flagUrl: flag("gh") },
  { id: "pa", nameEs: "Panamá", group: "L", flagUrl: flag("pa") },
];

/** Normaliza un nombre para emparejar (sin acentos, minúsculas, sin signos). */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Slug para la URL de jornadaperfecta (minúsculas, sin acentos, con guiones). */
export function slugify(name: string): string {
  return normalizeName(name).replace(/\s+/g, "-");
}
