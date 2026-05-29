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

  // Edition en place : on garde editingId + editData (les champs en cours
  // de modification). Le password est intentionnellement vide par defaut —
  // saisir une valeur signifie "remplacer", laisser vide = pas de changement.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({
    email: "",
    fullName: "",
    password: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

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

  const startEdit = (profile: Profile) => {
    setEditingId(profile.id);
    setEditData({
      email: profile.email,
      fullName: profile.full_name || "",
      password: "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({ email: "", fullName: "", password: "" });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setSavingEdit(true);
    try {
      const res = await fetch("/api/users/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: editingId,
          email: editData.email,
          fullName: editData.fullName,
          password: editData.password, // string vide = pas de changement cote API
        }),
      });
      const text = await res.text();
      let data: { error?: string } = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { error: `Réponse serveur invalide (HTTP ${res.status}).` };
      }
      if (!res.ok) throw new Error(data.error || `Erreur HTTP ${res.status}`);

      toast.success(
        editData.password
          ? "Éditeur mis à jour (mot de passe inclus)"
          : "Éditeur mis à jour"
      );
      cancelEdit();
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
    setSavingEdit(false);
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
                const isEditing = editingId === profile.id;
                return (
                  <>
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
                        <div className="flex justify-end gap-1.5">
                          {!isMe && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-8"
                              onClick={() =>
                                isEditing ? cancelEdit() : startEdit(profile)
                              }
                            >
                              {isEditing ? "Fermer" : "Modifier"}
                            </Button>
                          )}
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
                        </div>
                      </TableCell>
                    </TableRow>
                    {isEditing && (
                      <TableRow key={`${profile.id}-edit`}>
                        <TableCell colSpan={5} className="bg-muted/30 p-0">
                          <div className="p-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-xs">Nom complet</Label>
                                <Input
                                  value={editData.fullName}
                                  onChange={(e) =>
                                    setEditData((prev) => ({
                                      ...prev,
                                      fullName: e.target.value,
                                    }))
                                  }
                                  placeholder="Jean Dupont"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs">Email</Label>
                                <Input
                                  type="email"
                                  value={editData.email}
                                  onChange={(e) =>
                                    setEditData((prev) => ({
                                      ...prev,
                                      email: e.target.value,
                                    }))
                                  }
                                  placeholder="email@exemple.com"
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">
                                Nouveau mot de passe{" "}
                                <span className="text-muted-foreground/70 font-normal">
                                  (laisser vide pour ne pas changer)
                                </span>
                              </Label>
                              <Input
                                type="password"
                                value={editData.password}
                                onChange={(e) =>
                                  setEditData((prev) => ({
                                    ...prev,
                                    password: e.target.value,
                                  }))
                                }
                                placeholder="Min. 6 caractères"
                                autoComplete="new-password"
                                minLength={6}
                              />
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={cancelEdit}
                                disabled={savingEdit}
                              >
                                Annuler
                              </Button>
                              <Button
                                size="sm"
                                onClick={handleSaveEdit}
                                disabled={savingEdit}
                              >
                                {savingEdit ? "Sauvegarde…" : "Sauvegarder"}
                              </Button>
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                              Le changement d&apos;email ou de mot de passe modifie
                              les credentials de connexion immédiatement.
                              Prévenez l&apos;utilisateur si nécessaire.
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
