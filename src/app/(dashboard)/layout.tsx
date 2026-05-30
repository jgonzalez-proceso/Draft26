import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Topbar from "@/components/layout/Topbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, email")
    .eq("id", user.id)
    .single();

  const displayName = profile?.display_name || profile?.email || "Mi cuenta";

  return (
    <div className="relative min-h-screen">
      {/* Fondo de campo de fútbol para las páginas que no traen su propio fondo
          (las que sí lo traen, como la portada de liga, lo cubren). */}
      <div
        aria-hidden
        className="fixed inset-0 -z-10"
        style={{
          backgroundImage:
            "linear-gradient(rgba(7,16,12,0.88), rgba(5,11,8,0.93)), url('/fondo-campo.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <Topbar displayName={displayName} />
      <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
    </div>
  );
}
