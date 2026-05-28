"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import type { Profile } from "@/lib/types";

export function UsersManager({
  profiles: initialProfiles,
  currentUserId,
}: {
  profiles: Profile[];
  currentUserId: string;
}) {
  const router = useRouter();
  // Le state local sert juste à se rafraîchir après création.
  // Les rôles sont en lecture seule : un seul admin (le current user), tous les autres = editeur.
  const [profiles] = useState(initialProfiles);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    fullName: "",
  });

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const res = await fetch("/api/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });

      const text = await res.text();
      let data: { error?: string } = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { error: `Réponse serveur invalide (HTTP ${res.status}).` };
      }
      if (!res.ok) {
        throw new Error(data.error || `Erreur HTTP ${res.status}`);
      }

      toast.success("Éditeur créé");
      setShowForm(false);
      setNewUser({ email: "", password: "", fullName: "" });
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erreur lors de la création"
      );
    }
    setCreating(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Annuler" : "Ajouter un éditeur"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Nouvel éditeur</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nom complet</Label>
                  <Input
                    id="fullName"
                    value={newUser.fullName}
                    onChange={(e) =>
                      setNewUser({ ...newUser, fullName: e.target.value })
                    }
                    placeholder="Jean Dupont"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUser.email}
                    onChange={(e) =>
                      setNewUser({ ...newUser, email: e.target.value })
                    }
                    placeholder="jean@exemple.com"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  value={newUser.password}
                  onChange={(e) =>
                    setNewUser({ ...newUser, password: e.target.value })
                  }
                  placeholder="Min. 6 caractères"
                  minLength={6}
                  required
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={creating}>
                  {creating ? "Création..." : "Créer l'éditeur"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Inscrit le</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.map((profile) => (
              <TableRow key={profile.id}>
                <TableCell className="font-medium">
                  {profile.full_name || "-"}
                </TableCell>
                <TableCell>{profile.email}</TableCell>
                <TableCell>
                  {profile.id === currentUserId ? (
                    <Badge>Admin</Badge>
                  ) : (
                    <Badge variant="secondary">Éditeur</Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(profile.created_at).toLocaleDateString("fr-FR")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
