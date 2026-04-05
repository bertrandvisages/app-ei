"use client";

import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  image: string;
}

type SortKey = "title" | "author" | "date" | "status";
type SortDir = "asc" | "desc";

export default function ContributionsPage() {
  const [authors, setAuthors] = useState<Author[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editSeoTitle, setEditSeoTitle] = useState("");
  const [editSeoDesc, setEditSeoDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newAuthorId, setNewAuthorId] = useState<string>("");
  const [newSeoTitle, setNewSeoTitle] = useState("");
  const [newSeoDesc, setNewSeoDesc] = useState("");

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

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sorted = useMemo(() => {
    return [...contributions].sort((a, b) => {
      let va: string;
      let vb: string;
      switch (sortKey) {
        case "title": va = a.title; vb = b.title; break;
        case "author": va = getAuthorName(a.author); vb = getAuthorName(b.author); break;
        case "date": va = a.date; vb = b.date; break;
        case "status": va = a.status; vb = b.status; break;
      }
      return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contributions, sortKey, sortDir, authors]);

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
          seo_title: newSeoTitle || undefined,
          seo_description: newSeoDesc || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success("Contribution créée");
      setShowForm(false);
      setNewTitle("");
      setNewContent("");
      setNewAuthorId("");
      setNewSeoTitle("");
      setNewSeoDesc("");
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
      setEditSeoTitle("");
      setEditSeoDesc("");
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
          seo_title: editSeoTitle || undefined,
          seo_description: editSeoDesc || undefined,
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

  const SortArrow = ({ col }: { col: SortKey }) => (
    <svg
      className={`inline-block ml-1 h-3 w-3 transition-transform ${sortKey === col ? "text-foreground" : "text-muted-foreground/40"} ${sortKey === col && sortDir === "desc" ? "rotate-180" : ""}`}
      fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
    </svg>
  );

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
                  <select
                    value={newAuthorId}
                    onChange={(e) => setNewAuthorId(e.target.value)}
                    className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    required
                  >
                    <option value="">Choisir un auteur</option>
                    {authors.map((a) => (
                      <option key={a.id} value={a.id.toString()}>
                        {a.name}
                      </option>
                    ))}
                  </select>
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
              <div className="rounded-md border p-4 space-y-3 bg-muted/30">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Données SEO</p>
                <div className="space-y-2">
                  <Label className="text-xs">Titre SEO</Label>
                  <Input
                    value={newSeoTitle}
                    onChange={(e) => setNewSeoTitle(e.target.value)}
                    placeholder="Titre optimisé pour le référencement"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Meta description</Label>
                  <Input
                    value={newSeoDesc}
                    onChange={(e) => setNewSeoDesc(e.target.value)}
                    placeholder="Description de 155 caractères max"
                    maxLength={160}
                  />
                  <p className="text-[10px] text-muted-foreground text-right">{newSeoDesc.length}/160</p>
                </div>
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

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("title")}>
                Titre <SortArrow col="title" />
              </TableHead>
              <TableHead className="w-[160px] cursor-pointer select-none" onClick={() => toggleSort("author")}>
                Auteur <SortArrow col="author" />
              </TableHead>
              <TableHead className="w-[110px] cursor-pointer select-none" onClick={() => toggleSort("date")}>
                Date <SortArrow col="date" />
              </TableHead>
              <TableHead className="w-[100px] cursor-pointer select-none" onClick={() => toggleSort("status")}>
                Publié <SortArrow col="status" />
              </TableHead>
              <TableHead className="w-[120px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  Aucune contribution
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((contrib) => (
                <>
                  <TableRow
                    key={contrib.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleEdit(contrib)}
                  >
                    <TableCell className="text-muted-foreground">
                      <svg
                        className={`h-4 w-4 transition-transform ${editingId === contrib.id ? "rotate-90" : ""}`}
                        fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {contrib.image && (
                          <img src={contrib.image} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                        )}
                        <p className="font-medium text-sm line-clamp-1">{contrib.title}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {getAuthorName(contrib.author)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(contrib.date).toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell>
                      {contrib.status === "publish" ? (
                        <span className="text-xs text-green-600 font-medium">Oui</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Non</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
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
                    </TableCell>
                  </TableRow>

                  {editingId === contrib.id && (
                    <TableRow key={`${contrib.id}-edit`}>
                      <TableCell colSpan={6} className="bg-muted/30 p-0">
                        <div className="p-5 space-y-4">
                          {contrib.image && (
                            <img src={contrib.image.replace(/-\d+x\d+\./, '.')} alt="" className="rounded-lg w-1/2" />
                          )}
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
                          <div className="rounded-md border p-4 space-y-3 bg-muted/30">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Données SEO</p>
                            <div className="space-y-2">
                              <Label className="text-xs">Titre SEO</Label>
                              <Input
                                value={editSeoTitle}
                                onChange={(e) => setEditSeoTitle(e.target.value)}
                                placeholder="Titre optimisé pour le référencement"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Meta description</Label>
                              <Input
                                value={editSeoDesc}
                                onChange={(e) => setEditSeoDesc(e.target.value)}
                                placeholder="Description de 155 caractères max"
                                maxLength={160}
                              />
                              <p className="text-[10px] text-muted-foreground text-right">{editSeoDesc.length}/160</p>
                            </div>
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
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
