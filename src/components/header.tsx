"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { Profile } from "@/lib/types";

// Event que les pages dossiers / contributions émettent après un publish
// pour rafraîchir le compteur "X publications en attente" sans attendre
// le prochain focus / polling.
export const PENDING_DEPLOY_EVENT = "lenoncote:pending-deploy-changed";

export function Header({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const router = useRouter();
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [deploying, setDeploying] = useState(false);

  const refreshPending = useCallback(async () => {
    try {
      const res = await fetch("/api/wordpress/deploy", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setPendingCount(typeof data.pending_count === "number" ? data.pending_count : 0);
    } catch {}
  }, []);

  useEffect(() => {
    refreshPending();
    const onFocus = () => refreshPending();
    const onCustom = () => refreshPending();
    window.addEventListener("focus", onFocus);
    window.addEventListener(PENDING_DEPLOY_EVENT, onCustom);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(PENDING_DEPLOY_EVENT, onCustom);
    };
  }, [refreshPending]);

  const handleDeploy = async () => {
    setDeploying(true);
    try {
      const res = await fetch("/api/wordpress/deploy", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Erreur");
      toast.success("Mise à jour du site lancée (≈ 1 min)");
      setPendingCount(0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setDeploying(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const initials = profile.full_name
    ? profile.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : profile.email[0].toUpperCase();

  const hasPending = (pendingCount ?? 0) > 0;

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-6">
      <div className="md:hidden font-bold text-lg">Le Non Coté</div>
      <div className="flex-1" />
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          onClick={handleDeploy}
          disabled={deploying || !hasPending}
          className={
            hasPending
              ? "bg-[#E35205] hover:bg-[#c44604] text-white"
              : ""
          }
          variant={hasPending ? "default" : "outline"}
          title={
            hasPending
              ? `Déclencher un rebuild du site public (${pendingCount} publication${pendingCount! > 1 ? "s" : ""} en attente)`
              : "Aucune publication en attente"
          }
        >
          {deploying
            ? "Lancement…"
            : hasPending
            ? `Mettre à jour le site (${pendingCount})`
            : "Site à jour"}
        </Button>
        <Badge variant={profile.role === "admin" ? "default" : "secondary"}>
          {profile.role}
        </Badge>
        <DropdownMenu>
          <DropdownMenuTrigger className="relative h-8 w-8 rounded-full cursor-pointer">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{profile.full_name}</p>
              <p className="text-xs text-muted-foreground">{profile.email}</p>
            </div>
            <DropdownMenuItem onClick={handleLogout}>
              Se déconnecter
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
