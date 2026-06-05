import Link from "next/link";
import { getMyLeagues } from "@/lib/leagues";
import LeagueCard from "@/components/leagues/LeagueCard";

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
            <LeagueCard key={league.id} league={league} role={role} />
          ))}
        </div>
      )}
    </div>
  );
}
