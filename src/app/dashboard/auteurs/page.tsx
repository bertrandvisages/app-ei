"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichEditor } from "@/components/rich-editor";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  image_id: number | null;
  link: string;
  job_title: string;
  company: string;
  company_website: string;
  linkedin: string;
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
  const [newImageId, setNewImageId] = useState<number | null>(null);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [editImageId, setEditImageId] = useState<number | null>(null);
  const [editImageUrl, setEditImageUrl] = useState("");
  const [authorContribs, setAuthorContribs] = useState<Record<number, { id: number; title: string; status: string; date: string }[]>>({});
  const [newAuthor, setNewAuthor] = useState({
    first_name: "",
    last_name: "",
    description: "",
    job_title: "",
    company: "",
    company_website: "",
    linkedin: "",
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
      if (res.ok) setAuthors(await res.json());
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
      setNewAuthor({ first_name: "", last_name: "", description: "", job_title: "", company: "", company_website: "", linkedin: "" });
      setNewImageId(null);
      setNewImageUrl("");
      const res2 = await fetch("/api/wordpress/authors");
      if (res2.ok) setAuthors(await res2.json());
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
      // Fetch contributions for this author
      if (!authorContribs[author.id]) {
        const res = await fetch(`/api/wordpress/contributions?author_id=${author.id}`);
        if (res.ok) {
          const data = await res.json();
          setAuthorContribs((prev) => ({ ...prev, [author.id]: data }));
        }
      }
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
                    <svg
                      className={`h-4 w-4 text-muted-foreground transition-transform ${editingId === author.id ? "rotate-180" : ""}`}
                      fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
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
                  {/* Contributions de l'auteur */}
                  {authorContribs[author.id] && authorContribs[author.id].length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">
                        Contributions ({authorContribs[author.id].length})
                      </Label>
                      <div className="rounded-md border divide-y">
                        {authorContribs[author.id].map((c) => (
                          <div key={c.id} className="flex items-center justify-between px-3 py-2">
                            <div>
                              <p className="text-sm font-medium">{c.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(c.date).toLocaleDateString("fr-FR")}
                              </p>
                            </div>
                            <Badge
                              variant={c.status === "publish" ? "default" : "secondary"}
                              className="text-[10px]"
                            >
                              {c.status === "publish" ? "Publié" : "Brouillon"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

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
    </div>
  );
}
