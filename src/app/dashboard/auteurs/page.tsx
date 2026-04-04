"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import type { Profile } from "@/lib/types";

interface Author {
  id: number;
  name: string;
  first_name: string;
  last_name: string;
  slug: string;
  email: string;
  description: string;
  avatar_url: string;
  link: string;
}

export default function AuteursPage() {
  const supabase = createClient();
  const router = useRouter();
  const [authors, setAuthors] = useState<Author[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<Author | null>(null);
  const [saving, setSaving] = useState(false);
  const [newAuthor, setNewAuthor] = useState({
    username: "",
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    description: "",
  });

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        setIsAdmin((profile as Profile)?.role === "admin");
      }

      const res = await fetch("/api/wordpress/authors");
      if (res.ok) {
        const data = await res.json();
        setAuthors(data);
      }
      setLoading(false);
    }
    load();
  }, [supabase, router]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/wordpress/authors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAuthor),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(`Auteur ${data.name} créé`);
      setShowForm(false);
      setNewAuthor({ username: "", email: "", password: "", first_name: "", last_name: "", description: "" });
      const res2 = await fetch("/api/wordpress/authors");
      if (res2.ok) setAuthors(await res2.json());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
    setCreating(false);
  };

  const toggleEdit = (author: Author) => {
    if (editingId === author.id) {
      setEditingId(null);
      setEditData(null);
    } else {
      setEditingId(author.id);
      setEditData({ ...author });
    }
  };

  const handleSave = async () => {
    if (!editData) return;
    setSaving(true);
    try {
      const res = await fetch("/api/wordpress/authors", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editData.id,
          first_name: editData.first_name,
          last_name: editData.last_name,
          email: editData.email,
          description: editData.description,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success("Auteur mis à jour");
      setAuthors(authors.map((a) =>
        a.id === editData.id
          ? { ...a, ...editData, name: `${editData.first_name} ${editData.last_name}`.trim() }
          : a
      ));
      setEditingId(null);
      setEditData(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Auteurs</h1>
          <p className="text-muted-foreground">
            {authors.length} auteur{authors.length > 1 ? "s" : ""} sur lenoncote.fr
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? "Annuler" : "Nouvel auteur"}
          </Button>
        )}
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Créer un auteur</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">Prénom</Label>
                  <Input
                    id="first_name"
                    value={newAuthor.first_name}
                    onChange={(e) => setNewAuthor({ ...newAuthor, first_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Nom</Label>
                  <Input
                    id="last_name"
                    value={newAuthor.last_name}
                    onChange={(e) => setNewAuthor({ ...newAuthor, last_name: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Identifiant</Label>
                  <Input
                    id="username"
                    value={newAuthor.username}
                    onChange={(e) => setNewAuthor({ ...newAuthor, username: e.target.value })}
                    placeholder="prenom-nom"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="author_email">Email</Label>
                  <Input
                    id="author_email"
                    type="email"
                    value={newAuthor.email}
                    onChange={(e) => setNewAuthor({ ...newAuthor, email: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="author_password">Mot de passe</Label>
                <Input
                  id="author_password"
                  type="password"
                  value={newAuthor.password}
                  onChange={(e) => setNewAuthor({ ...newAuthor, password: e.target.value })}
                  minLength={8}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="author_description">Biographie</Label>
                <Textarea
                  id="author_description"
                  rows={4}
                  value={newAuthor.description}
                  onChange={(e) => setNewAuthor({ ...newAuthor, description: e.target.value })}
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={creating}>
                  {creating ? "Création..." : "Créer l'auteur"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {authors.map((author) => (
          <Card key={author.id}>
            <CardContent className="pt-6">
              <div
                className="flex items-start gap-4 cursor-pointer"
                onClick={() => toggleEdit(author)}
              >
                {author.avatar_url ? (
                  <img
                    src={author.avatar_url}
                    alt={author.name}
                    className="w-16 h-16 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <span className="text-lg font-medium text-muted-foreground">
                      {author.name.charAt(0)}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-base">{author.name}</h3>
                    <svg
                      className={`h-4 w-4 text-muted-foreground transition-transform ${editingId === author.id ? "rotate-180" : ""}`}
                      fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </div>
                  {author.email && (
                    <p className="text-xs text-muted-foreground">{author.email}</p>
                  )}
                  {editingId !== author.id && author.description && (
                    <p
                      className="mt-2 text-xs text-muted-foreground line-clamp-2"
                      dangerouslySetInnerHTML={{ __html: author.description }}
                    />
                  )}
                </div>
              </div>

              {editingId === author.id && editData && (
                <div className="mt-4 space-y-4">
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">Prénom</Label>
                      <Input
                        value={editData.first_name}
                        onChange={(e) => setEditData({ ...editData, first_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">Nom</Label>
                      <Input
                        value={editData.last_name}
                        onChange={(e) => setEditData({ ...editData, last_name: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">Email</Label>
                    <Input
                      type="email"
                      value={editData.email}
                      onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">Biographie</Label>
                    <Textarea
                      rows={6}
                      value={editData.description}
                      onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setEditingId(null); setEditData(null); }}
                    >
                      Annuler
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={saving}>
                      {saving ? "Enregistrement..." : "Enregistrer"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
