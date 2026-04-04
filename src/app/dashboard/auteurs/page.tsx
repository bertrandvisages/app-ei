"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import type { Profile } from "@/lib/types";

interface Author {
  id: number;
  name: string;
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
      // Reload authors
      const res2 = await fetch("/api/wordpress/authors");
      if (res2.ok) setAuthors(await res2.json());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
    setCreating(false);
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {authors.map((author) => (
          <Card key={author.id}>
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
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
                <div className="min-w-0">
                  <h3 className="font-semibold text-base">{author.name}</h3>
                  {author.email && (
                    <p className="text-xs text-muted-foreground">{author.email}</p>
                  )}
                  <a
                    href={author.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#E35205] hover:underline"
                  >
                    Voir le profil &rarr;
                  </a>
                </div>
              </div>
              {author.description && (
                <p
                  className="mt-3 text-xs text-muted-foreground line-clamp-4"
                  dangerouslySetInnerHTML={{ __html: author.description }}
                />
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
