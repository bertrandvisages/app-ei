"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichEditorFull } from "@/components/rich-editor-full";
import { toast } from "sonner";

interface Author {
  id: number;
  name: string;
  avatar_url: string;
}

interface Contribution {
  id: number;
  title: string;
  content: string;
  status: string;
  author: number;
  date: string;
  link: string;
}

export default function ContributionsPage() {
  const [authors, setAuthors] = useState<Author[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState<number | null>(null);

  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newAuthorId, setNewAuthorId] = useState<string>("");

  useEffect(() => {
    async function load() {
      const [authorsRes, contribRes] = await Promise.all([
        fetch("/api/wordpress/authors"),
        fetch("/api/wordpress/contributions"),
      ]);
      if (authorsRes.ok) setAuthors(await authorsRes.json());
      if (contribRes.ok) setContributions(await contribRes.json());
      setLoading(false);
    }
    load();
  }, []);

  const getAuthorName = (authorId: number) => {
    return authors.find((a) => a.id === authorId)?.name || "Inconnu";
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAuthorId) {
      toast.error("Sélectionnez un auteur");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/wordpress/contributions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          content: newContent,
          author_id: parseInt(newAuthorId, 10),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success("Contribution créée");
      setShowForm(false);
      setNewTitle("");
      setNewContent("");
      setNewAuthorId("");
      // Reload
      const res2 = await fetch("/api/wordpress/contributions");
      if (res2.ok) setContributions(await res2.json());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
    setCreating(false);
  };

  const toggleEdit = (contrib: Contribution) => {
    if (editingId === contrib.id) {
      setEditingId(null);
    } else {
      setEditingId(contrib.id);
      setEditTitle(contrib.title);
      setEditContent(contrib.content);
    }
  };

  const handleSave = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/wordpress/contributions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          title: editTitle,
          content: editContent,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success("Sauvegardé");
      setContributions(contributions.map((c) =>
        c.id === editingId ? { ...c, title: editTitle, content: editContent } : c
      ));
      setEditingId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
    setSaving(false);
  };

  const handlePublish = async (id: number) => {
    setPublishing(id);
    try {
      const res = await fetch("/api/wordpress/contributions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "publish" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success("Publié sur le site");
      setContributions(contributions.map((c) =>
        c.id === id ? { ...c, status: "publish" } : c
      ));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
    setPublishing(null);
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
          <h1 className="text-2xl font-bold">Contributions</h1>
          <p className="text-muted-foreground">
            Articles Dossiers rédigés par les auteurs
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Annuler" : "Nouvelle contribution"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Nouvelle contribution</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Auteur</Label>
                  <Select
                    value={newAuthorId}
                    onValueChange={(v: string | null) => setNewAuthorId(v || "")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir un auteur" />
                    </SelectTrigger>
                    <SelectContent>
                      {authors.map((a) => (
                        <SelectItem key={a.id} value={a.id.toString()}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Titre</Label>
                  <Input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Contenu</Label>
                <RichEditorFull
                  content={newContent}
                  onChange={setNewContent}
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={creating}>
                  {creating ? "Création..." : "Créer la contribution"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {contributions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Aucune contribution
            </CardContent>
          </Card>
        ) : (
          contributions.map((contrib) => (
            <Card key={contrib.id}>
              <CardContent className="pt-5">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => toggleEdit(contrib)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm line-clamp-1">{contrib.title}</h3>
                      <Badge
                        variant={contrib.status === "publish" ? "default" : "secondary"}
                        className="text-[10px] flex-shrink-0"
                      >
                        {contrib.status === "publish" ? "Publié" : "Brouillon"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {getAuthorName(contrib.author)} &middot; {new Date(contrib.date).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {contrib.status === "draft" && (
                      <Button
                        size="sm"
                        className="text-xs h-7 bg-[#E35205] hover:bg-[#c44604]"
                        onClick={() => handlePublish(contrib.id)}
                        disabled={publishing === contrib.id}
                      >
                        {publishing === contrib.id ? "..." : "Publier"}
                      </Button>
                    )}
                    {contrib.status === "publish" && contrib.link && (
                      <a href={contrib.link} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="text-xs h-7">
                          Voir
                        </Button>
                      </a>
                    )}
                    <svg
                      className={`h-4 w-4 text-muted-foreground transition-transform cursor-pointer ${editingId === contrib.id ? "rotate-180" : ""}`}
                      fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                      onClick={() => toggleEdit(contrib)}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </div>
                </div>

                {editingId === contrib.id && (
                  <div className="mt-4 space-y-4 border-t pt-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">Titre</Label>
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">Contenu</Label>
                      <RichEditorFull
                        content={editContent}
                        onChange={setEditContent}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>
                        Annuler
                      </Button>
                      <Button size="sm" onClick={handleSave} disabled={saving}>
                        {saving ? "..." : "Sauvegarder"}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
