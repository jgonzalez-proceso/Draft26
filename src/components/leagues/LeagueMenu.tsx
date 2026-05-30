"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { LogOut, Trophy, Copy, Share2, Check } from "lucide-react";
import { LEAGUE_STATUS_LABELS, type LeagueStatus } from "@/types/domain";

interface Member {
  display_name: string;
  role: "admin" | "member";
  draft_order: number | null;
}

// Portada (Menu.png procesada, con su pie horneado): 1518×665.
const IMG_W = 1518;
const IMG_H = 665;

// Opciones del menú: zonas clicables sobre el texto ya presente en la imagen.
const HOTSPOTS = [
  { key: "draft", label: "Draft", path: "draft", x0: 878, x1: 1045, y0: 194, y1: 232 },
  { key: "jugadores", label: "Base de Datos", path: "jugadores", x0: 878, x1: 1270, y0: 250, y1: 289 },
  { key: "equipos", label: "Equipos", path: "equipos", x0: 878, x1: 1105, y0: 305, y1: 344 },
  { key: "historial", label: "Historial", path: "historial", x0: 878, x1: 1160, y0: 361, y1: 400 },
] as const;

// Altura del menú horizontal superior (Topbar). Se descuenta para que la
// portada ocupe el resto de la pantalla sin scroll.
const TOPBAR = 56;
const pct = (v: number, total: number) => `${(v / total) * 100}%`;

export default function LeagueMenu({
  leagueId,
  status,
  inviteCode,
  maxParticipants,
  members,
  isAdmin,
}: {
  leagueId: string;
  name: string;
  status: LeagueStatus;
  inviteCode: string;
  worldCupYear: number;
  maxParticipants: number;
  members: Member[];
  isAdmin: boolean;
}) {
  const base = `/ligas/${leagueId}`;
  const statusHref = isAdmin ? `${base}/admin` : `${base}/draft`;
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  async function copy(what: "code" | "link") {
    const value =
      what === "code"
        ? inviteCode
        : `${typeof window !== "undefined" ? window.location.origin : ""}/ligas/unirse?code=${inviteCode}`;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* noop */
    }
  }

  return (
    // Full-bleed + tirar hacia arriba para cancelar los paddings de los layouts
    // y dejar la portada justo bajo el menú superior, a pantalla completa.
    <div
      style={{
        width: "100vw",
        marginLeft: "calc(50% - 50vw)",
        marginTop: "-48px",
        marginBottom: "-24px",
      }}
    >
      <div
        className="grid place-items-center overflow-hidden bg-[#04150c] px-1"
        style={{ height: `calc(100svh - ${TOPBAR}px)` }}
      >
        {/* Lienzo escalado para caber sin scroll; sirve de contenedor de
            consultas para que el pie escale con la portada. */}
        <div
          className="relative overflow-hidden rounded-md shadow-[0_8px_30px_rgba(0,0,0,0.5)] ring-1 ring-black/60"
          style={{
            aspectRatio: `${IMG_W} / ${IMG_H}`,
            maxWidth: "100%",
            maxHeight: "100%",
            width: `min(100%, calc((100svh - ${TOPBAR}px) * ${IMG_W} / ${IMG_H}))`,
            containerType: "inline-size",
          }}
        >
          <Image
            src="/liga-portada.png"
            alt="Portada de la liga — estilo PC Fútbol"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />

          {/* Opciones del menú (clicables) */}
          {HOTSPOTS.map((h) => (
            <Link
              key={h.key}
              href={`${base}/${h.path}`}
              aria-label={h.label}
              className="group absolute rounded-md outline-none transition-colors duration-150 hover:bg-amber-300/10 focus-visible:bg-amber-300/15 focus-visible:ring-2 focus-visible:ring-amber-300/80"
              style={{
                left: pct(h.x0, IMG_W),
                top: pct(h.y0, IMG_H),
                width: pct(h.x1 - h.x0, IMG_W),
                height: pct(h.y1 - h.y0, IMG_H),
              }}
            >
              <span className="pointer-events-none absolute inset-y-0 -left-2 w-1 rounded bg-amber-300 opacity-0 transition-opacity duration-150 group-hover:opacity-90" />
            </Link>
          ))}

          {/* ── Menú inferior DINÁMICO superpuesto sobre el pie de la imagen ── */}
          <div
            className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-[2cqi] border-t-2 border-amber-500/50 px-[2.5cqi]"
            style={{
              height: "18.2%",
              background:
                "linear-gradient(180deg, #07190e 0%, #051409 55%, #040f07 100%)",
            }}
          >
            {/* Estado + participantes (clicable) */}
            <Link
              href={statusHref}
              aria-label={`${LEAGUE_STATUS_LABELS[status]} — ${members.length} de ${maxParticipants} mánagers`}
              className="group flex min-w-0 items-center gap-[1.4cqi] rounded-md p-[0.6cqi] outline-none transition-colors hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-amber-300/70"
            >
              <span className="grid aspect-square shrink-0 place-items-center rounded-full bg-gradient-to-b from-amber-300 to-amber-600 text-emerald-950 shadow ring-1 ring-amber-200/40 w-[3.4cqi]">
                <Trophy className="size-[1.9cqi]" />
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block truncate font-extrabold uppercase tracking-wide text-amber-300 group-hover:text-amber-200 text-[clamp(10px,1.55cqi,22px)]">
                  {LEAGUE_STATUS_LABELS[status]}
                </span>
                <span className="block font-semibold uppercase tracking-widest text-emerald-200/80 text-[clamp(8px,1.05cqi,14px)]">
                  {members.length}/{maxParticipants} mánagers
                </span>
              </span>
            </Link>

            {/* Código de invitación + acciones */}
            <div className="flex shrink-0 items-center gap-[1.2cqi]">
              <div className="flex items-center gap-[1.2cqi] rounded-md border border-amber-500/40 bg-black/45 px-[1.4cqi] py-[0.9cqi]">
                <span className="hidden font-semibold uppercase tracking-wider text-emerald-200/70 text-[clamp(9px,1.05cqi,13px)] md:inline">
                  Código de invitación
                </span>
                <span className="font-mono font-bold tracking-[0.18em] text-amber-200 text-[clamp(11px,1.5cqi,20px)]">
                  {inviteCode}
                </span>
                <button
                  onClick={() => copy("code")}
                  className="flex items-center gap-[0.5cqi] rounded font-semibold text-emerald-100 transition-colors hover:text-white text-[clamp(9px,1.15cqi,15px)]"
                  title="Copiar código"
                >
                  {copied === "code" ? (
                    <Check className="size-[1.4cqi] text-emerald-300" />
                  ) : (
                    <Copy className="size-[1.4cqi]" />
                  )}
                  <span className="hidden sm:inline">copiar</span>
                </button>
                <span className="text-amber-500/30">|</span>
                <button
                  onClick={() => copy("link")}
                  className="flex items-center gap-[0.5cqi] rounded font-semibold text-emerald-100 transition-colors hover:text-white text-[clamp(9px,1.15cqi,15px)]"
                  title="Copiar enlace de invitación"
                >
                  {copied === "link" ? (
                    <Check className="size-[1.4cqi] text-emerald-300" />
                  ) : (
                    <Share2 className="size-[1.4cqi]" />
                  )}
                  <span className="hidden sm:inline">enlace</span>
                </button>
              </div>
              <Link
                href="/ligas"
                title="Salir a mis ligas"
                aria-label="Salir a mis ligas"
                className="grid aspect-square shrink-0 place-items-center rounded-md border border-white/15 bg-black/40 text-slate-200 transition-colors hover:bg-black/60 hover:text-white w-[3.4cqi]"
              >
                <LogOut className="size-[1.7cqi]" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
