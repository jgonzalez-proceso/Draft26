import Link from "next/link";
import Image from "next/image";
import { Shuffle, Zap, Timer } from "lucide-react";

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Hero de fondo */}
      <div className="absolute inset-0 -z-10">
        <Image
          src="/hero.jpg"
          alt="Estrellas del Mundial alrededor del trofeo"
          fill
          priority
          className="object-cover object-center opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
      </div>

      {/* Cabecera */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <div className="flex items-center gap-2">
          <Image src="/icon.png" alt="" width={30} height={30} className="rounded" />
          <span className="text-lg font-extrabold tracking-tight">
            Draft <span className="text-gold-400">Mundial 26</span>
          </span>
        </div>
        <nav className="flex items-center gap-3">
          <Link href="/login" className="btn-ghost">
            Entrar
          </Link>
          <Link href="/register" className="btn-gold">
            Crear cuenta
          </Link>
        </nav>
      </header>

      {/* Contenido */}
      <section className="mx-auto flex max-w-4xl flex-col items-center px-5 pb-24 pt-16 text-center sm:pt-24">
        <span className="badge bg-pitch-500/15 text-pitch-300 ring-1 ring-inset ring-pitch-500/30">
          Mundial 2026 · Draft fantástico por turnos
        </span>
        <h1 className="mt-6 text-balance text-4xl font-black leading-tight tracking-tight sm:text-6xl">
          Sortea el orden.{" "}
          <span className="text-gold-400">Elige a las estrellas.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-balance text-base text-muted sm:text-lg">
          Crea una liga con tus amigos, realiza el sorteo y repartíos por turnos
          a los jugadores de las selecciones del Mundial. Sin precios ni pujas:
          orden riguroso, jugador único, todo en tiempo real.
        </p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <Link href="/register" className="btn-gold px-6 py-3 text-base">
            Empezar gratis
          </Link>
          <Link href="/login" className="btn-ghost px-6 py-3 text-base">
            Ya tengo cuenta
          </Link>
        </div>

        <div className="mt-16 grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              Icon: Shuffle,
              title: "Sorteo del orden",
              desc: "Orden de elección aleatorio y visible para todos.",
            },
            {
              Icon: Zap,
              title: "Picks en tiempo real",
              desc: "El dashboard se actualiza al instante para toda la liga.",
            },
            {
              Icon: Timer,
              title: "Turno con cronómetro",
              desc: "Tiempo por pick configurable; si se agota, pasa turno.",
            },
          ].map((f) => (
            <div key={f.title} className="card p-5 text-left transition-colors hover:border-pitch-500">
              <f.Icon className="h-6 w-6 text-gold-400" />
              <h3 className="mt-3 font-bold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
