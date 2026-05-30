import Link from "next/link";
import JoinLeagueForm from "@/components/leagues/JoinLeagueForm";

export default function UnirseLigaPage({
  searchParams,
}: {
  searchParams: { code?: string };
}) {
  return (
    <div className="mx-auto max-w-sm">
      <div className="mb-6">
        <Link href="/ligas" className="text-sm text-muted hover:text-foreground">
          ← Mis ligas
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Unirme a una liga</h1>
        <p className="text-sm text-muted">
          Introduce el código que te ha pasado el administrador de la liga.
        </p>
      </div>
      <div className="card p-6">
        <JoinLeagueForm initialCode={searchParams.code ?? ""} />
      </div>
    </div>
  );
}
