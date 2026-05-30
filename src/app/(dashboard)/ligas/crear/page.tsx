import Link from "next/link";
import CreateLeagueForm from "@/components/leagues/CreateLeagueForm";

export default function CrearLigaPage() {
  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6">
        <Link href="/ligas" className="text-sm text-muted hover:text-foreground">
          ← Mis ligas
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Crear liga</h1>
        <p className="text-sm text-muted">
          Serás el administrador. Podrás invitar participantes, sortear el orden e iniciar el draft.
        </p>
      </div>
      <div className="card p-6">
        <CreateLeagueForm />
      </div>
    </div>
  );
}
