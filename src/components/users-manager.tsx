"use client";

import { useCallback, useEffect, useState } from "react";
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
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    fullName: "",
  });

  const refetch = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setProfiles(data as Profile[]);
  }, []);

  useEffect(() => {
    setProfiles(initialProfiles);
  }, [initialProfiles]);

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
      await refetch();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erreur lors de la création"
      );
    }
    setCreating(false);
  };

  const handleDelete = async (profile: Profile) => {
    const name = profile.full_name || profile.email;
    const confirmed = window.confirm(
      `Supprimer définitivement « ${name} » ?\n\nLe compte sera désactivé et il ne pourra plus accéder au dashboard.`
    );
    if (!confirmed) return;

    setDeletingId(profile.id);
    try {
      const res = await fetch("/api/users/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: profile.id }),
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

      toast.success("Éditeur supprimé");
      // Mise à jour optimiste + refetch en arrière-plan
      setProfiles((prev) => prev.filter((p) => p.id !== profile.id));
      refetch();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erreur lors de la suppression"
      );
    } finally {
      setDeletingId(null);
    }
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
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Aucun éditeur pour le moment.
                </TableCell>
              </TableRow>
            ) : (
              profiles.map((profile) => {
                const isMe = profile.id === currentUserId;
                return (
                  <TableRow key={profile.id}>
                    <TableCell className="font-medium">
                      {profile.full_name || "—"}
                    </TableCell>
                    <TableCell>{profile.email}</TableCell>
                    <TableCell>
                      {isMe ? (
                        <Badge>Admin</Badge>
                      ) : (
                        <Badge variant="secondary">Éditeur</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(profile.created_at).toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell className="text-right">
                      {!isMe && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-8 text-destructive hover:bg-destructive hover:text-white"
                          onClick={() => handleDelete(profile)}
                          disabled={deletingId === profile.id}
                        >
                          {deletingId === profile.id ? "Suppression…" : "Supprimer"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
