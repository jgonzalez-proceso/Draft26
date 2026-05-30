import Link from "next/link";
import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <Image src="/icon.png" alt="" width={32} height={32} className="rounded" />
          <span className="text-lg font-extrabold tracking-tight">
            Draft <span className="text-gold-400">Mundial 26</span>
          </span>
        </Link>
        <div className="card p-6">{children}</div>
      </div>
    </main>
  );
}
