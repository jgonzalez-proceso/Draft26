import Link from "next/link";
import Image from "next/image";
import { LogOut } from "lucide-react";

export default function Topbar({ displayName }: { displayName: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-4">
          <Link href="/ligas" className="flex items-center gap-2">
            <Image src="/icon.png" alt="" width={26} height={26} className="rounded" />
            <span className="font-extrabold tracking-tight">
              Draft <span className="text-gold-400">Mundial 26</span>
            </span>
          </Link>
          <Link
            href="/ligas"
            className="text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            Mis ligas
          </Link>
          <Link
            href="/resultados"
            className="text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            Resultados
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/perfil" className="text-sm text-muted transition-colors hover:text-foreground">
            {displayName}
          </Link>
          <form action="/auth/signout" method="post">
            <button className="btn-ghost px-3 py-1.5 text-xs" type="submit">
              <LogOut className="h-3.5 w-3.5" />
              Salir
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
