import { createClient } from "@/lib/supabase/server";
import ProfileForm from "@/components/profile/ProfileForm";

export default async function ProfilePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, email")
    .eq("id", user!.id)
    .single();

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-2xl font-bold">Mi perfil</h1>
      <div className="card p-6">
        <ProfileForm
          initialDisplayName={profile?.display_name ?? ""}
          email={profile?.email ?? user?.email ?? ""}
        />
      </div>
    </div>
  );
}
