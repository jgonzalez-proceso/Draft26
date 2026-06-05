import type { MetadataRoute } from "next";

// Manifest de la PWA. Next lo sirve en /manifest.webmanifest. Con display
// "standalone", al "Añadir a pantalla de inicio" la app se abre sin la barra
// del navegador.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Draft Mundial 26",
    short_name: "Draft 26",
    description:
      "Draft fantástico del Mundial 2026 — sortea el orden y elige por turnos a las estrellas de cada selección.",
    start_url: "/ligas",
    display: "standalone",
    orientation: "any",
    background_color: "#04150c",
    theme_color: "#04150c",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
