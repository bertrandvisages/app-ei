import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import type { Profile } from "@/lib/types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  // Filet de sécurité : si la ligne `profiles` est absente ou illisible, on ne
  // casse plus tout le dashboard (avant : `profile as Profile` puis
  // `profile.full_name` → crash "This page couldn't load"). On reconstruit un
  // profil minimal depuis l'utilisateur auth, role `editeur` = moindre
  // privilège (on ne fabrique JAMAIS un admin). Fix DB : (ré)insérer la ligne
  // dans `profiles` pour retrouver le bon role.
  const safeProfile: Profile = profile ?? {
    id: user.id,
    email: user.email ?? "",
    full_name:
      (user.user_metadata?.full_name as string | undefined) ?? null,
    role: "editeur",
    created_at: user.created_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar profile={safeProfile} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header profile={safeProfile} />
        <main className="flex-1 overflow-y-auto p-6 bg-muted/30">
          {children}
        </main>
      </div>
    </div>
  );
}
