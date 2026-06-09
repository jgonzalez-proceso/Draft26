"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import StatusBadge from "@/components/leagues/StatusBadge";
import type { LeagueStatus } from "@/types/domain";

export default function LeagueNav({
  leagueId,
  name,
  status,
  isAdmin,
}: {
  leagueId: string;
  name: string;
  status: LeagueStatus;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const base = `/ligas/${leagueId}`;
  const onMenu = pathname === base;

  const tabs = [
    { href: base, label: "Menú" },
    { href: `${base}/draft`, label: "Draft" },
    { href: `${base}/jugadores`, label: "Selecciones" },
    { href: `${base}/equipos`, label: "Equipos" },
    { href: `${base}/historial`, label: "Historial" },
    { href: `${base}/porra`, label: "La Porra" },
    ...(isAdmin ? [{ href: `${base}/admin`, label: "Admin" }] : []),
  ];

  return (
    <div>
      {/* «Mis ligas» vive ahora en el menú superior (Topbar). En la pantalla-menú
          no mostramos cabecera ni tabs (la portada ya las trae). */}
      {!onMenu && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {/* En modo app: volver a la portada (no hay pestañas) */}
              <Link
                href={base}
                aria-label="Volver al menú"
                className="app-only items-center gap-1 rounded-md border border-line bg-surface-2 px-2 py-1.5 text-sm text-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
                Menú
              </Link>
              <h1 className="text-2xl font-bold">{name}</h1>
            </div>
            <StatusBadge status={status} />
          </div>
          <nav className="app-hide -mb-px flex gap-2 overflow-x-auto border-b border-line">
            {tabs.map((t) => {
              const active = t.href === base ? pathname === base : pathname.startsWith(t.href);
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={`whitespace-nowrap border-b-2 px-4 py-3 font-display text-xl tracking-[0.08em] transition-colors ${
                    active
                      ? "border-gold-500 text-gold-300"
                      : "border-transparent text-foreground/70 hover:text-foreground"
                  }`}
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>
        </>
      )}
    </div>
  );
}
