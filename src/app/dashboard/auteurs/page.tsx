"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichEditor } from "@/components/rich-editor";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";
import { PENDING_DEPLOY_EVENT } from "@/components/header";
import { toast } from "sonner";
import type { Profile } from "@/lib/types";

interface Author {
  id: string;
  name: string;
  first_name: string;
  last_name: string;
  slug: string;
  email: string;
  description: string;
  avatar_url: string;
  image_id: number | null;
  link: string;
  job_title: string;
  company: string;
  company_website: string;
  linkedin: string;
  seo_title: string;
  seo_description: string;
}

function PhotoUpload({
  currentUrl,
  onUploaded,
}: {
  currentUrl: string;
  onUploaded: (id: number, url: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(currentUrl);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPreview(URL.createObjectURL(file));
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/wordpress/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      onUploaded(data.id, data.url);
      setPreview(data.url);
      toast.success("Photo uploadée");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur upload");
      setPreview(currentUrl);
    }
    setUploading(false);
  };

  return (
    <div className="flex items-center gap-4">
      {preview ? (
        <img src={preview} alt="Photo" className="w-20 h-20 rounded-full object-cover" />
      ) : (
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
          <span className="text-xs text-muted-foreground">Photo</span>
        </div>
      )}
      <div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "Upload..." : preview ? "Changer la photo" : "Ajouter une photo"}
        </Button>
      </div>
    </div>
  );
}

export default function AuteursPage() {
  const [authors, setAuthors] = useState<Author[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  // Cible courante du dialog de confirmation. null = dialog ferme.
  const [deleteTarget, setDeleteTarget] = useState<Author | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Author | null>(null);
  const [saving, setSaving] = useState(false);
  const [newImageId, setNewImageId] = useState<number | null>(null);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [editImageId, setEditImageId] = useState<number | null>(null);
  const [editImageUrl, setEditImageUrl] = useState("");
  type AuthorContentItem = { id: string; title: string; status: string; date: string };
  const [authorContent, setAuthorContent] = useState<Record<string, { dossiers: AuthorContentItem[]; opinions: AuthorContentItem[] }>>({});
  const [newAuthor, setNewAuthor] = useState({
    first_name: "",
    last_name: "",
    description: "",
    job_title: "",
    company: "",
    company_website: "",
    linkedin: "",
    seo_title: "",
    seo_description: "",
  });
  const [generatingSeo, setGeneratingSeo] = useState(false);
  const [generatingSeoNew, setGeneratingSeoNew] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
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
      if (res.ok) setAuthors(await res.json());
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/wordpress/authors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newAuthor,
          image_id: newImageId,
          image_url: newImageUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(`Auteur ${data.name} créé`);
      setShowForm(false);
      setNewAuthor({ first_name: "", last_name: "", description: "", job_title: "", company: "", company_website: "", linkedin: "", seo_title: "", seo_description: "" });
      setNewImageId(null);
      setNewImageUrl("");
      const res2 = await fetch("/api/wordpress/authors");
      if (res2.ok) setAuthors(await res2.json());
      window.dispatchEvent(new Event(PENDING_DEPLOY_EVENT));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
    setCreating(false);
  };

  const toggleEdit = async (author: Author) => {
    if (editingId === author.id) {
      setEditingId(null);
      setEditData(null);
      setEditImageId(null);
      setEditImageUrl("");
    } else {
      setEditingId(author.id);
      setEditData({ ...author });
      setEditImageId(null);
      setEditImageUrl("");
      // Refetch dossiers + opinions liés à l'auteur à chaque ouverture
      // pour avoir l'état à jour (pas de cache : sinon, après une
      // publication ailleurs, la liste reste périmée).
      const [dossiersRes, opinionsRes] = await Promise.all([
        fetch(`/api/wordpress/dossiers?author_id=${author.id}`),
        fetch(`/api/wordpress/contributions?author_id=${author.id}`),
      ]);
      const dossiers: AuthorContentItem[] = dossiersRes.ok ? await dossiersRes.json() : [];
      const opinions: AuthorContentItem[] = opinionsRes.ok ? await opinionsRes.json() : [];
      setAuthorContent((prev) => ({ ...prev, [author.id]: { dossiers, opinions } }));
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
          job_title: editData.job_title,
          company: editData.company,
          company_website: editData.company_website,
          linkedin: editData.linkedin,
          seo_title: editData.seo_title,
          seo_description: editData.seo_description,
          image_id: editImageId || undefined,
          image_url: editImageUrl || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success("Auteur mis à jour");
      const updatedAuthor = {
        ...editData,
        name: `${editData.first_name} ${editData.last_name}`.trim(),
        avatar_url: editImageUrl || editData.avatar_url,
      };
      setAuthors(authors.map((a) => a.id === editData.id ? updatedAuthor : a));
      setEditingId(null);
      setEditData(null);
      window.dispatchEvent(new Event(PENDING_DEPLOY_EVENT));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
    setSaving(false);
  };

  const handleGenerateSeoEdit = async () => {
    if (!editData) return;
    const fullName = `${editData.first_name} ${editData.last_name}`.trim();
    if (!fullName) {
      toast.error("Renseigne d'abord un prénom ou un nom");
      return;
    }
    setGeneratingSeo(true);
    try {
      const res = await fetch("/api/generate-seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "author",
          name: fullName,
          job_title: editData.job_title,
          company: editData.company,
          bio: editData.description,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setEditData({
        ...editData,
        seo_title: data.seo_title || "",
        seo_description: data.seo_description || "",
      });
      toast.success("Title et description SEO générés");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setGeneratingSeo(false);
    }
  };

  const handleGenerateSeoNew = async () => {
    const fullName = `${newAuthor.first_name} ${newAuthor.last_name}`.trim();
    if (!fullName) {
      toast.error("Renseigne d'abord un prénom ou un nom");
      return;
    }
    setGeneratingSeoNew(true);
    try {
      const res = await fetch("/api/generate-seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "author",
          name: fullName,
          job_title: newAuthor.job_title,
          company: newAuthor.company,
          bio: newAuthor.description,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setNewAuthor({
        ...newAuthor,
        seo_title: data.seo_title || "",
        seo_description: data.seo_description || "",
      });
      toast.success("Title et description SEO générés");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setGeneratingSeoNew(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return;
    const res = await fetch(
      `/api/wordpress/authors?id=${encodeURIComponent(deleteTarget.id)}`,
      { method: "DELETE" }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || "Suppression échouée");
      return;
    }
    setAuthors((prev) => prev.filter((a) => a.id !== deleteTarget.id));
    if (editingId === deleteTarget.id) {
      setEditingId(null);
      setEditData(null);
    }
    toast.success("Auteur supprimé");
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
              <PhotoUpload
                currentUrl=""
                onUploaded={(id, url) => { setNewImageId(id); setNewImageUrl(url); }}
              />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prénom</Label>
                  <Input
                    value={newAuthor.first_name}
                    onChange={(e) => setNewAuthor({ ...newAuthor, first_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nom</Label>
                  <Input
                    value={newAuthor.last_name}
                    onChange={(e) => setNewAuthor({ ...newAuthor, last_name: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fonction</Label>
                  <Input
                    value={newAuthor.job_title}
                    onChange={(e) => setNewAuthor({ ...newAuthor, job_title: e.target.value })}
                    placeholder="Président, Directeur..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Société</Label>
                  <Input
                    value={newAuthor.company}
                    onChange={(e) => setNewAuthor({ ...newAuthor, company: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Site web entreprise</Label>
                  <Input
                    value={newAuthor.company_website}
                    onChange={(e) => setNewAuthor({ ...newAuthor, company_website: e.target.value })}
                    placeholder="https://www.exemple.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>LinkedIn</Label>
                  <Input
                    value={newAuthor.linkedin}
                    onChange={(e) => setNewAuthor({ ...newAuthor, linkedin: e.target.value })}
                    placeholder="https://www.linkedin.com/in/..."
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Biographie</Label>
                <RichEditor
                  content={newAuthor.description}
                  onChange={(html) => setNewAuthor({ ...newAuthor, description: html })}
                />
              </div>
              <div className="rounded-md border p-4 space-y-3 bg-muted/30">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Données SEO</p>
                  {isAdmin && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-xs h-7"
                      onClick={handleGenerateSeoNew}
                      disabled={generatingSeoNew}
                      title="Générer un title et une meta description SEO via Gemini"
                    >
                      {generatingSeoNew ? "Génération…" : "Générer le SEO"}
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Titre SEO</Label>
                  <Input
                    value={newAuthor.seo_title}
                    onChange={(e) => setNewAuthor({ ...newAuthor, seo_title: e.target.value })}
                    placeholder="Titre de 60 caractères max"
                    maxLength={60}
                  />
                  <p className="text-[10px] text-muted-foreground text-right">{newAuthor.seo_title.length}/60</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Meta description</Label>
                  <Input
                    value={newAuthor.seo_description}
                    onChange={(e) => setNewAuthor({ ...newAuthor, seo_description: e.target.value })}
                    placeholder="Description de 160 caractères max"
                    maxLength={160}
                  />
                  <p className="text-[10px] text-muted-foreground text-right">{newAuthor.seo_description.length}/160</p>
                </div>
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
                    <div>
                      <h3 className="font-semibold text-base">{author.name}</h3>
                      {(author.job_title || author.company) && (
                        <p className="text-xs text-muted-foreground">
                          {[author.job_title, author.company].filter(Boolean).join(" - ")}
                        </p>
                      )}
                    </div>
                    <div
                      className="flex items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="destructive"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => setDeleteTarget(author)}
                        title="Supprimer cet auteur"
                      >
                        Suppr.
                      </Button>
                      <button
                        type="button"
                        onClick={() => toggleEdit(author)}
                        className="p-1 -m-1 rounded hover:bg-muted text-muted-foreground"
                        title={editingId === author.id ? "Replier" : "Déplier"}
                        aria-label={editingId === author.id ? "Replier" : "Déplier"}
                      >
                        <svg
                          className={`h-4 w-4 transition-transform ${editingId === author.id ? "rotate-180" : ""}`}
                          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  {editingId !== author.id && (
                    <>
                      <div className="flex gap-3 mt-1">
                        {author.linkedin && (
                          <a href={author.linkedin} target="_blank" rel="noopener noreferrer" className="text-xs text-[#E35205] hover:underline" onClick={(e) => e.stopPropagation()}>
                            LinkedIn
                          </a>
                        )}
                        {author.company_website && (
                          <a href={author.company_website} target="_blank" rel="noopener noreferrer" className="text-xs text-[#E35205] hover:underline" onClick={(e) => e.stopPropagation()}>
                            Site web
                          </a>
                        )}
                      </div>
                      {author.description && (
                        <p className="mt-2 text-xs text-muted-foreground line-clamp-2" dangerouslySetInnerHTML={{ __html: author.description }} />
                      )}
                    </>
                  )}
                </div>
              </div>

              {editingId === author.id && editData && (
                <div className="mt-4 space-y-4">
                  <Separator />
                  <PhotoUpload
                    currentUrl={editData.avatar_url}
                    onUploaded={(id, url) => { setEditImageId(id); setEditImageUrl(url); }}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">Prénom</Label>
                      <Input value={editData.first_name} onChange={(e) => setEditData({ ...editData, first_name: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">Nom</Label>
                      <Input value={editData.last_name} onChange={(e) => setEditData({ ...editData, last_name: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">Fonction</Label>
                      <Input value={editData.job_title} onChange={(e) => setEditData({ ...editData, job_title: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">Société</Label>
                      <Input value={editData.company} onChange={(e) => setEditData({ ...editData, company: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">Site web entreprise</Label>
                      <Input value={editData.company_website} onChange={(e) => setEditData({ ...editData, company_website: e.target.value })} placeholder="https://www.exemple.com" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">LinkedIn</Label>
                      <Input value={editData.linkedin} onChange={(e) => setEditData({ ...editData, linkedin: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">Biographie</Label>
                    <RichEditor
                      content={editData.description}
                      onChange={(html) => setEditData({ ...editData, description: html })}
                    />
                  </div>
                  <div className="rounded-md border p-4 space-y-3 bg-muted/30">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Données SEO</p>
                      {isAdmin && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-xs h-7"
                          onClick={handleGenerateSeoEdit}
                          disabled={generatingSeo}
                          title="Générer un title et une meta description SEO via Gemini"
                        >
                          {generatingSeo ? "Génération…" : "Générer le SEO"}
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Titre SEO</Label>
                      <Input
                        value={editData.seo_title}
                        onChange={(e) => setEditData({ ...editData, seo_title: e.target.value })}
                        placeholder="Titre de 60 caractères max"
                        maxLength={60}
                      />
                      <p className="text-[10px] text-muted-foreground text-right">{editData.seo_title.length}/60</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Meta description</Label>
                      <Input
                        value={editData.seo_description}
                        onChange={(e) => setEditData({ ...editData, seo_description: e.target.value })}
                        placeholder="Description de 160 caractères max"
                        maxLength={160}
                      />
                      <p className="text-[10px] text-muted-foreground text-right">{editData.seo_description.length}/160</p>
                    </div>
                  </div>
                  {/* Dossiers et opinions liés à l'auteur */}
                  {(() => {
                    const content = authorContent[author.id];
                    if (!content) return null;
                    const dossiers = content.dossiers;
                    const opinions = content.opinions;
                    if (dossiers.length === 0 && opinions.length === 0) return null;
                    const renderList = (items: AuthorContentItem[], label: string) => (
                      items.length === 0 ? null : (
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-muted-foreground">
                            {label} ({items.length})
                          </Label>
                          <div className="rounded-md border divide-y">
                            {items.map((it) => (
                              <div key={it.id} className="flex items-center justify-between px-3 py-2">
                                <div>
                                  <p className="text-sm font-medium">{it.title}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(it.date).toLocaleDateString("fr-FR")}
                                  </p>
                                </div>
                                <Badge
                                  variant={it.status === "publish" ? "default" : "secondary"}
                                  className="text-[10px]"
                                >
                                  {it.status === "publish" ? "Publié" : "Brouillon"}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    );
                    return (
                      <>
                        {renderList(dossiers, "Dossiers")}
                        {renderList(opinions, "Opinions")}
                      </>
                    );
                  })()}

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setEditingId(null); setEditData(null); }}>
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

      <DeleteConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        itemLabel={`l'auteur « ${deleteTarget?.name ?? ""} »`}
        description="Cette action est irréversible. Si des dossiers ou opinions sont rattachés à cet auteur, leur référence devra être réassignée manuellement."
        onConfirm={handleDeleteConfirmed}
      />
    </div>
  );
}
