"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut, Menu, RefreshCw, X } from "lucide-react";

const NAV = [
  { href: "/ligas", label: "Mis ligas" },
  { href: "/resultados", label: "Resultados" },
];

export default function Topbar({ displayName }: { displayName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 800);
  }

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        {/* Marca + nav desktop */}
        <div className="flex items-center gap-6">
          <Link href="/ligas" className="flex items-center gap-2" onClick={() => setOpen(false)}>
            <Image src="/icon.png" alt="" width={30} height={30} className="rounded" />
            <span className="font-display text-2xl tracking-[0.08em]">
              Draft <span className="text-gold-400">Mundial 26</span>
            </span>
          </Link>

          <nav className="app-hide hidden items-center gap-5 md:flex">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`font-display text-lg tracking-[0.07em] transition-colors ${
                  isActive(n.href)
                    ? "text-gold-300"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Acciones desktop */}
        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/perfil"
            className={`text-sm transition-colors ${
              isActive("/perfil") ? "text-gold-300" : "text-muted hover:text-foreground"
            }`}
          >
            {displayName}
          </Link>
          <form action="/auth/signout" method="post">
            <button className="btn-ghost px-3 py-1.5 text-xs" type="submit">
              <LogOut className="h-3.5 w-3.5" />
              Salir
            </button>
          </form>
        </div>

        {/* Botones derecha móvil */}
        <div className="flex items-center gap-1 md:hidden">
          {/* Refresco — siempre visible en móvil */}
          <button
            type="button"
            onClick={handleRefresh}
            aria-label="Refrescar página"
            className="grid h-11 w-11 place-items-center rounded-lg text-muted outline-none transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-gold-400"
          >
            <RefreshCw className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`} />
          </button>

          {/* Hamburguesa — oculta en modo app */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
            aria-controls="mobile-nav"
            className="app-hide grid h-11 w-11 place-items-center rounded-lg text-foreground outline-none transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-gold-400"
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>

          {/* Salir — solo en modo app (sin hamburguesa) */}
          <form action="/auth/signout" method="post" className="app-only">
            <button className="btn-ghost px-3 py-2 text-sm" type="submit" aria-label="Salir">
              <LogOut className="h-4 w-4" />
              Salir
            </button>
          </form>
        </div>
      </div>

      {/* Panel desplegable móvil */}
      {open && (
        <nav
          id="mobile-nav"
          className="border-t border-line bg-surface px-4 py-2 md:hidden"
        >
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              className={`flex min-h-[48px] items-center font-display text-xl tracking-[0.08em] ${
                isActive(n.href) ? "text-gold-300" : "text-foreground"
              }`}
            >
              {n.label}
            </Link>
          ))}
          <Link
            href="/perfil"
            onClick={() => setOpen(false)}
            className={`flex min-h-[48px] items-center text-base ${
              isActive("/perfil") ? "text-gold-300" : "text-muted"
            }`}
          >
            {displayName}
          </Link>
          <form action="/auth/signout" method="post" className="py-2">
            <button className="btn-ghost w-full justify-center py-2.5 text-sm" type="submit">
              <LogOut className="h-4 w-4" />
              Salir
            </button>
          </form>
        </nav>
      )}
    </header>
  );
}
