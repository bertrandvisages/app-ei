"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { UsersManager } from "@/components/users-manager";
import type { Profile } from "@/lib/types";

export default function UtilisateursPage() {
  const supabase = createClient();
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [userId, setUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!currentProfile || currentProfile.role !== "admin") {
        router.push("/dashboard");
        return;
      }

      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      setProfiles((allProfiles as Profile[]) || []);
      setUserId(user.id);
      setLoading(false);
    }

    load();
  }, [supabase, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Utilisateurs</h1>
        <p className="text-muted-foreground">
          Gérer les rôles des utilisateurs
        </p>
      </div>
      <UsersManager profiles={profiles} currentUserId={userId} />
    </div>
  );
}
