import Link from "next/link";
import { getMyLeagues } from "@/lib/leagues";
import StatusBadge from "@/components/leagues/StatusBadge";

export default async function LigasPage() {
  const leagues = await getMyLeagues();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Mis ligas</h1>
        <div className="flex gap-2">
          <Link href="/ligas/unirse" className="btn-ghost">
            Unirme
          </Link>
          <Link href="/ligas/crear" className="btn-gold">
            Crear liga
          </Link>
        </div>
      </div>

      {leagues.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-muted">
            Aún no estás en ninguna liga. Crea una nueva o únete con un código de invitación.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <Link href="/ligas/crear" className="btn-gold">
              Crear mi primera liga
            </Link>
            <Link href="/ligas/unirse" className="btn-ghost">
              Tengo un código
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {leagues.map(({ league, role }) => (
            <Link
              key={league.id}
              href={`/ligas/${league.id}`}
              className="card p-5 transition-colors hover:border-pitch-500"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-lg font-bold">{league.name}</h2>
                <StatusBadge status={league.status} />
              </div>
              <p className="mt-1 text-sm text-muted">
                Mundial {league.world_cup_year} · Máx. {league.max_participants} ·{" "}
                {role === "admin" ? "Admin" : "Participante"}
              </p>
              <p className="mt-3 font-mono text-xs text-muted">
                Código: <span className="text-gold-400">{league.invite_code}</span>
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
