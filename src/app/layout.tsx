import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Cuerpo: Inter (variable, ultralegible). Títulos/nav: Bebas Neue (cartel deportivo).
const inter = localFont({
  src: "./fonts/Inter-latin.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});
const bebas = localFont({
  src: "./fonts/BebasNeue-latin.woff2",
  variable: "--font-display",
  weight: "400",
  display: "swap",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Draft Mundial 26",
  description:
    "Draft fantástico del Mundial 2026 — sortea el orden y elige por turnos a las estrellas de cada selección.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${inter.variable} ${bebas.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
