"use client";

import { useEffect, useRef, useState, useMemo } from "react";
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
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";
import { PENDING_DEPLOY_EVENT } from "@/components/header";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface Author {
  id: string;
  name: string;
  avatar_url: string;
}

interface Contribution {
  id: string;
  title: string;
  slug: string;
  content: string;
  citation: string;
  status: string;
  is_modified?: boolean;
  author: string;
  date: string;
  created_at: string;
  updated_at: string;
  scheduled_publish_at: string | null;
  link: string;
  image: string;
  image_id: number | null;
  seo_title: string;
  seo_description: string;
}

interface ImageCandidate {
  url: string;
  id: number;
}

type SortKey = "title" | "author" | "date" | "status";
type SortDir = "asc" | "desc";

// ISO UTC → "YYYY-MM-DDTHH:mm" en heure locale pour input datetime-local.
function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
}
function fromLocalInputValue(local: string): string {
  return new Date(local).toISOString();
}

export default function ContributionsPage() {
  const [authors, setAuthors] = useState<Author[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editCitation, setEditCitation] = useState("");
  const [editAuthorId, setEditAuthorId] = useState<string>("");
  const [editCoverUrl, setEditCoverUrl] = useState("");
  const [genCandidates, setGenCandidates] = useState<Record<string, string[]>>({});
  const [generatingCitation, setGeneratingCitation] = useState(false);
  const [editSeoTitle, setEditSeoTitle] = useState("");
  const [editSeoDesc, setEditSeoDesc] = useState("");
  const [editScheduledAt, setEditScheduledAt] = useState("");
  const [scheduling, setScheduling] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState<string | null>(null);
  // Cible courante du dialog de confirmation. null = dialog ferme.
  const [deleteTarget, setDeleteTarget] = useState<Contribution | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newAuthorId, setNewAuthorId] = useState<string>("");
  const [newSeoTitle, setNewSeoTitle] = useState("");
  const [newSeoDesc, setNewSeoDesc] = useState("");
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [imageStyle, setImageStyle] = useState("");
  // Map: contrib.id -> array of image candidates added during the session
  const [candidates, setCandidates] = useState<Record<string, ImageCandidate[]>>({});
  // Map: contrib.id -> selected image_id (null = use existing)
  const [selectedImage, setSelectedImage] = useState<Record<string, number | null>>({});
  // Track which contribs have unsaved image changes
  const [dirtyImages, setDirtyImages] = useState<Set<string>>(new Set());
  const [isAdmin, setIsAdmin] = useState(false);
  const [generatingSeo, setGeneratingSeo] = useState(false);

  // Restore session state on mount
  useEffect(() => {
    try {
      const c = sessionStorage.getItem("contrib_candidates");
      const s = sessionStorage.getItem("contrib_selected");
      const d = sessionStorage.getItem("contrib_dirty");
      if (c) setCandidates(JSON.parse(c));
      if (s) setSelectedImage(JSON.parse(s));
      if (d) setDirtyImages(new Set(JSON.parse(d)));
    } catch {}
  }, []);

  // Persist on change
  useEffect(() => {
    try {
      sessionStorage.setItem("contrib_candidates", JSON.stringify(candidates));
    } catch {}
  }, [candidates]);

  useEffect(() => {
    try {
      sessionStorage.setItem("contrib_selected", JSON.stringify(selectedImage));
    } catch {}
  }, [selectedImage]);

  useEffect(() => {
    try {
      sessionStorage.setItem("contrib_dirty", JSON.stringify(Array.from(dirtyImages)));
    } catch {}
  }, [dirtyImages]);

  // Persistance des 3 vignettes (genCandidates) sur la session — pour qu'on
  // retrouve l'historique de generations / uploads en quittant puis en
  // revenant sur une opinion dans le meme onglet.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("contrib_gen_candidates");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") setGenCandidates(parsed);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem("contrib_gen_candidates", JSON.stringify(genCandidates));
    } catch {}
  }, [genCandidates]);

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
        setIsAdmin((profile as { role?: string } | null)?.role === "admin");
      }
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

  const handleGenerateSeo = async () => {
    if (!editingId) return;
    if (!editTitle.trim()) {
      toast.error("Renseigne d'abord un titre");
      return;
    }
    setGeneratingSeo(true);
    try {
      const res = await fetch("/api/generate-seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          content: editContent,
          type: "opinion",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setEditSeoTitle(data.seo_title || "");
      setEditSeoDesc(data.seo_description || "");
      toast.success("Title et description SEO générés");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setGeneratingSeo(false);
    }
  };

  const getAuthorName = (authorId: string) => {
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
          author_id: newAuthorId,
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

  const handleGenerateCitation = async () => {
    if (!editTitle.trim()) {
      toast.error("Le titre est nécessaire pour générer une citation");
      return;
    }
    setGeneratingCitation(true);
    try {
      const res = await fetch("/api/generate-citation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, content: editContent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setEditCitation(data.citation);
      toast.success("Citation générée");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setGeneratingCitation(false);
    }
  };

  const toggleEdit = (contrib: Contribution) => {
    if (editingId === contrib.id) {
      setEditingId(null);
    } else {
      setEditingId(contrib.id);
      setEditTitle(contrib.title);
      setEditContent(contrib.content);
      setEditCitation(contrib.citation || "");
      setEditAuthorId(contrib.author || "");
      setEditCoverUrl(contrib.image || "");
      // Seed les vignettes :
      // - si on a deja des candidates en session (qu'on a generes/uploades
      //   precedemment sans sauvegarder), on les garde et on s'assure que la
      //   cover actuelle est presente dans la liste
      // - si la session est vide pour cet item, on init avec [cover] ou []
      setGenCandidates((prev) => {
        const existing = prev[contrib.id] || [];
        if (existing.length > 0) {
          if (contrib.image && !existing.includes(contrib.image)) {
            return {
              ...prev,
              [contrib.id]: [contrib.image, ...existing].slice(0, 3),
            };
          }
          return prev;
        }
        return {
          ...prev,
          [contrib.id]: contrib.image ? [contrib.image] : [],
        };
      });
      setImageStyle("");
      setEditSeoTitle(contrib.seo_title || "");
      setEditSeoDesc(contrib.seo_description || "");
      setEditScheduledAt(
        contrib.scheduled_publish_at
          ? toLocalInputValue(contrib.scheduled_publish_at)
          : ""
      );
    }
  };

  // Upload depuis le disque : limite 5 MB cote client. L'API
  // /api/wordpress/upload convertit automatiquement en AVIF via le helper
  // toAvif (meme pipeline que les PNG Gemini).
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingIds, setUploadingIds] = useState<Set<string>>(new Set());

  const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

  const handlePickFile = () => {
    if (!editingId) return;
    if ((genCandidates[editingId]?.length || 0) >= 3) {
      toast.error("Limite de 3 images atteinte. Supprime-en une dans les vignettes pour pouvoir en ajouter.");
      return;
    }
    fileInputRef.current?.click();
  };

  const handleUploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !editingId) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Le fichier doit être une image");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(`Fichier trop lourd (${(file.size / 1024 / 1024).toFixed(1)} MB). Limite : 5 MB.`);
      return;
    }

    const id = editingId;
    setUploadingIds((prev) => new Set(prev).add(id));
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "contributions/uploaded");
      const res = await fetch("/api/wordpress/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload échoué");

      setGenCandidates((prev) => ({
        ...prev,
        [id]: [data.url, ...(prev[id] || [])].slice(0, 3),
      }));
      setEditCoverUrl(data.url);
      toast.success("Image uploadée (convertie en AVIF)");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload échoué");
    } finally {
      setUploadingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleGenerateGemini = async (contrib: Contribution) => {
    if (!editingId) return;
    if (!imageStyle) {
      toast.error("Choisis un style d'image");
      return;
    }
    setGeneratingIds((prev) => new Set(prev).add(editingId));
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle || contrib.title,
          content: editContent || contrib.content,
          style: imageStyle,
          folder: "contributions/generated",
          aspectRatio: "16:9",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur Gemini");

      setGenCandidates((prev) => ({
        ...prev,
        [editingId]: [data.url, ...(prev[editingId] || [])].slice(0, 3),
      }));
      setEditCoverUrl(data.url);
      toast.success("Image générée");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setGeneratingIds((prev) => {
        const next = new Set(prev);
        next.delete(editingId);
        return next;
      });
    }
  };

  const handleSave = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const currentContrib = contributions.find((c) => c.id === editingId);
      const coverChanged = editCoverUrl !== (currentContrib?.image || "");

      const res = await fetch("/api/wordpress/contributions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          title: editTitle,
          content: editContent,
          citation: editCitation,
          author_id: editAuthorId || null,
          seo_title: editSeoTitle || undefined,
          seo_description: editSeoDesc || undefined,
          ...(coverChanged ? { cover_image_url: editCoverUrl || null } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success("Sauvegardé");

      setContributions(contributions.map((c) =>
        c.id === editingId
          ? {
              ...c,
              title: editTitle,
              content: editContent,
              citation: editCitation,
              author: editAuthorId,
              // Resync du SEO local, sinon rouvrir l'edition sans recharger la
              // page reaffiche l'ancien SEO (vide) et il semble disparaitre.
              seo_title: editSeoTitle,
              seo_description: editSeoDesc,
              is_modified: c.status === "publish" ? true : c.is_modified,
              ...(coverChanged ? { image: editCoverUrl } : {}),
            }
          : c
      ));

      // Clear dirty flag and remove candidates for this post
      setDirtyImages((prev) => {
        const next = new Set(prev);
        next.delete(editingId);
        return next;
      });
      setCandidates((prev) => {
        const next = { ...prev };
        delete next[editingId];
        return next;
      });
      setSelectedImage((prev) => {
        const next = { ...prev };
        delete next[editingId];
        return next;
      });

      setEditingId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
    setSaving(false);
  };

  const handleGenerateImage = (contrib: Contribution) => {
    if (!imageStyle) {
      toast.error("Sélectionnez un style d'image");
      return;
    }

    // Fire and forget
    fetch("https://n8n.lenoncote.fr/webhook/4158ee4d-c5f6-439e-a0cf-e226e2c342a0", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        post_id: contrib.id,
        title: contrib.title,
        slug: contrib.slug,
        content: contrib.content,
        author: getAuthorName(contrib.author),
        style: imageStyle,
      }),
    }).catch(() => {});

    setGeneratingIds((prev) => new Set(prev).add(contrib.id));
    toast.success("Génération d'image lancée");
  };

  // Poll for image-ready notifications
  useEffect(() => {
    if (generatingIds.size === 0) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/contributions/notifications");
        if (!res.ok) return;
        const notifications = await res.json();

        for (const notif of notifications) {
          if (notif.post_id && notif.image_url && notif.image_id) {
            toast.success("Image générée !");
            // Add as a new candidate (max 3 total including existing)
            setCandidates((prev) => {
              const existing = prev[notif.post_id] || [];
              // We need 1 slot for the existing image, so max 2 candidates
              const newList = [...existing, { url: notif.image_url, id: notif.image_id }];
              // Keep only the last 2 candidates (existing image is the 3rd slot)
              return { ...prev, [notif.post_id]: newList.slice(-2) };
            });
            // Auto-select the new one
            setSelectedImage((prev) => ({ ...prev, [notif.post_id]: notif.image_id }));
            setDirtyImages((prev) => new Set(prev).add(notif.post_id));
            setGeneratingIds((prev) => {
              const next = new Set(prev);
              next.delete(notif.post_id);
              return next;
            });
          }
        }
      } catch {}
    }, 5000);

    return () => clearInterval(interval);
  }, [generatingIds]);

  // Warn before leaving with unsaved image changes
  useEffect(() => {
    if (dirtyImages.size === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirtyImages]);

  const handlePublish = async (id: string) => {
    setPublishing(id);
    try {
      const res = await fetch("/api/wordpress/contributions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "publish" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success("Marqué comme publié — clique « Mettre à jour le site » pour diffuser");
      setContributions(contributions.map((c) =>
        c.id === id ? { ...c, status: "publish", is_modified: false } : c
      ));
      window.dispatchEvent(new Event(PENDING_DEPLOY_EVENT));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
    setPublishing(null);
  };

  const handleSchedule = async () => {
    if (!editingId) return;
    if (!editScheduledAt) {
      toast.error("Choisis une date de mise en ligne");
      return;
    }
    const iso = fromLocalInputValue(editScheduledAt);
    if (new Date(iso).getTime() <= Date.now()) {
      toast.error("La date programmée doit être dans le futur");
      return;
    }
    setScheduling(editingId);
    try {
      const res = await fetch("/api/wordpress/contributions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          status: "programme",
          scheduled_publish_at: iso,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(
        `Programmé pour le ${new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}`
      );
      setContributions(contributions.map((c) =>
        c.id === editingId
          ? { ...c, status: "programme", scheduled_publish_at: iso, is_modified: false }
          : c
      ));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
    setScheduling(null);
  };

  const handleCancelSchedule = async (id: string) => {
    setScheduling(id);
    try {
      const res = await fetch("/api/wordpress/contributions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "draft" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success("Programmation annulée — repassé en brouillon");
      setContributions(contributions.map((c) =>
        c.id === id ? { ...c, status: "draft", scheduled_publish_at: null } : c
      ));
      if (editingId === id) setEditScheduledAt("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
    setScheduling(null);
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return;
    const res = await fetch(
      `/api/wordpress/contributions?id=${encodeURIComponent(deleteTarget.id)}`,
      { method: "DELETE" }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || "Suppression échouée");
      return;
    }
    setContributions((prev) => prev.filter((c) => c.id !== deleteTarget.id));
    if (editingId === deleteTarget.id) setEditingId(null);
    toast.success("Opinion supprimée");
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
            Dossiers rédigés par les auteurs
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
              <TableHead className="w-[140px] cursor-pointer select-none" onClick={() => toggleSort("date")}>
                Dates <SortArrow col="date" />
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
                    <TableCell className="text-[11px] text-muted-foreground leading-tight">
                      <div>
                        <span className="text-muted-foreground/70">Créé&nbsp;: </span>
                        {new Date(contrib.created_at).toLocaleDateString("fr-FR")}
                      </div>
                      <div>
                        <span className="text-muted-foreground/70">Modifié&nbsp;: </span>
                        {new Date(contrib.updated_at).toLocaleDateString("fr-FR")}
                      </div>
                    </TableCell>
                    <TableCell>
                      {contrib.status === "publish" ? (
                        contrib.is_modified ? (
                          <span className="text-xs text-amber-600 font-medium">Modifié</span>
                        ) : (
                          <span className="text-xs text-green-600 font-medium">Publié</span>
                        )
                      ) : contrib.status === "programme" ? (
                        <span
                          className="text-xs text-blue-600 font-medium"
                          title={
                            contrib.scheduled_publish_at
                              ? `Mise en ligne automatique le ${new Date(contrib.scheduled_publish_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}`
                              : undefined
                          }
                        >
                          {contrib.scheduled_publish_at
                            ? `Programmé · ${new Date(contrib.scheduled_publish_at).toLocaleDateString("fr-FR")}`
                            : "Programmé"}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Brouillon</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          className="text-xs h-7 bg-[#E35205] hover:bg-[#c44604]"
                          onClick={() => handlePublish(contrib.id)}
                          disabled={publishing === contrib.id}
                          title={
                            contrib.status === "publish"
                              ? "Marquer comme republié (la diffusion se fait via « Mettre à jour le site »)"
                              : "Marquer comme publié (la diffusion se fait via « Mettre à jour le site »)"
                          }
                        >
                          {publishing === contrib.id
                            ? "..."
                            : contrib.status === "publish"
                            ? "Republier"
                            : "Publier"}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => setDeleteTarget(contrib)}
                          title="Supprimer cette opinion"
                        >
                          Suppr.
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>

                  {editingId === contrib.id && (
                    <TableRow key={`${contrib.id}-edit`}>
                      <TableCell colSpan={6} className="bg-muted/30 p-0">
                        <div className="p-5 space-y-4">
                          {/* Aperçu de la cover actuelle */}
                          {editCoverUrl ? (
                            <div className="space-y-2">
                              <Label className="text-xs font-medium text-muted-foreground">Image actuelle</Label>
                              <img
                                src={editCoverUrl}
                                alt="Cover"
                                className="block rounded-lg border max-w-full"
                                style={{ maxHeight: 320 }}
                              />
                            </div>
                          ) : (
                            <div className="rounded-lg border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
                              Aucune image. Génère-en une ci-dessous.
                            </div>
                          )}

                          {/* Alternatives générées */}
                          {(genCandidates[contrib.id]?.length || 0) > 0 && (
                            <div className="space-y-2">
                              <Label className="text-xs font-medium text-muted-foreground">
                                Images disponibles ({genCandidates[contrib.id]?.length || 0}/3) — clique pour sélectionner
                              </Label>
                              <div className="flex gap-2 flex-wrap">
                                {genCandidates[contrib.id]!.map((url) => (
                                  <button
                                    type="button"
                                    key={url}
                                    onClick={() => setEditCoverUrl(url)}
                                    className={`relative rounded-md overflow-hidden border-2 transition-all ${
                                      editCoverUrl === url
                                        ? "border-[#E35205]"
                                        : "border-transparent hover:border-muted-foreground/30"
                                    }`}
                                  >
                                    <img src={url} alt="" className="block" style={{ width: 160, height: 90, objectFit: "cover" }} />
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Génération IA */}
                          <div className="rounded-md border p-4 space-y-3 bg-muted/30">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Générer une nouvelle image</p>
                            <div className="flex items-end gap-3">
                              <div className="flex-1 space-y-1">
                                <Label className="text-xs">Style</Label>
                                <select
                                  value={imageStyle}
                                  onChange={(e) => setImageStyle(e.target.value)}
                                  className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                >
                                  <option value="">Choisir un style…</option>
                                  <option value="corporate-elegant">Corporate élégant</option>
                                  <option value="analogie-sportive">Analogie sportive</option>
                                  <option value="metaphore-nature">Métaphore nature</option>
                                  <option value="industriel-terrain">Industriel / terrain</option>
                                  <option value="abstrait-data">Abstrait / data</option>
                                  <option value="architecture-infrastructure">Architecture / infrastructure</option>
                                  <option value="equipe-humain">Équipe / humain</option>
                                  <option value="echiquier-strategie">Échiquier / stratégie</option>
                                  <option value="exploration-aventure">Exploration / aventure</option>
                                  <option value="coffre-fort-patrimoine">Coffre-fort / patrimoine</option>
                                </select>
                              </div>
                              <Button
                                size="sm"
                                className="text-xs h-9 bg-[#E35205] hover:bg-[#c44604]"
                                onClick={() => handleGenerateGemini(contrib)}
                                disabled={
                                  generatingIds.has(contrib.id) ||
                                  !imageStyle ||
                                  (genCandidates[contrib.id]?.length || 0) >= 3
                                }
                              >
                                {generatingIds.has(contrib.id)
                                  ? "Génération…"
                                  : (genCandidates[contrib.id]?.length || 0) >= 3
                                  ? "Limite atteinte"
                                  : "Générer"}
                              </Button>
                            </div>
                            {(genCandidates[contrib.id]?.length || 0) >= 3 && (
                              <p className="text-[11px] text-muted-foreground">
                                Limite de 3 images atteinte. Choisis une vignette ci-dessus, ou sauvegarde puis rouvre l&apos;édition pour repartir.
                              </p>
                            )}
                          </div>

                          {/* Upload depuis le disque */}
                          <div className="rounded-md border p-4 space-y-3 bg-muted/30">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              Ou uploader une image depuis le disque
                            </p>
                            <div className="flex items-center gap-3">
                              <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleUploadCover}
                                className="hidden"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-9"
                                onClick={handlePickFile}
                                disabled={
                                  uploadingIds.has(contrib.id) ||
                                  (genCandidates[contrib.id]?.length || 0) >= 3
                                }
                              >
                                {uploadingIds.has(contrib.id)
                                  ? "Upload…"
                                  : (genCandidates[contrib.id]?.length || 0) >= 3
                                  ? "Limite atteinte"
                                  : "Choisir une image"}
                              </Button>
                              <p className="text-[11px] text-muted-foreground">
                                JPG, PNG, WebP… 5 MB max. Convertie automatiquement en AVIF.
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2 md:col-span-2">
                              <Label className="text-xs font-medium text-muted-foreground">Titre</Label>
                              <Input
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs font-medium text-muted-foreground">Auteur</Label>
                              <select
                                value={editAuthorId}
                                onChange={(e) => setEditAuthorId(e.target.value)}
                                className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                              >
                                <option value="">— Aucun —</option>
                                {authors.map((a) => (
                                  <option key={a.id} value={a.id.toString()}>
                                    {a.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-medium text-muted-foreground">
                              Citation <span className="text-muted-foreground/70">(affichée sur la carte du site, ~2-3 lignes)</span>
                            </Label>
                            <textarea
                              value={editCitation}
                              onChange={(e) => setEditCitation(e.target.value)}
                              rows={3}
                              placeholder="Phrase d'accroche de l'édito, mise en avant dans la liste publique."
                              className="flex w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
                            />
                            <div className="flex items-center justify-between">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="text-xs h-8"
                                onClick={handleGenerateCitation}
                                disabled={generatingCitation || !editTitle.trim()}
                                title="Génère une citation à partir du titre et du contenu via IA"
                              >
                                {generatingCitation ? "Génération…" : "✨ Générer avec IA"}
                              </Button>
                              <p className="text-[10px] text-muted-foreground">{editCitation.length} caractères</p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-medium text-muted-foreground">Contenu</Label>
                            <RichEditorFull
                              content={editContent}
                              onChange={setEditContent}
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
                                  onClick={handleGenerateSeo}
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
                                value={editSeoTitle}
                                onChange={(e) => setEditSeoTitle(e.target.value)}
                                placeholder="Titre de 60 caractères max"
                                maxLength={60}
                              />
                              <p className="text-[10px] text-muted-foreground text-right">{editSeoTitle.length}/60</p>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Meta description</Label>
                              <Input
                                value={editSeoDesc}
                                onChange={(e) => setEditSeoDesc(e.target.value)}
                                placeholder="Description de 160 caractères max"
                                maxLength={160}
                              />
                              <p className="text-[10px] text-muted-foreground text-right">{editSeoDesc.length}/160</p>
                            </div>
                          </div>
                          <div className="rounded-md border p-4 space-y-3 bg-muted/30">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              Programmer la mise en ligne
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Le job tourne tous les jours vers 5h du matin et publie automatiquement les opinions dont la date est passée (puis déclenche le rebuild du site).
                            </p>
                            <div className="flex items-end gap-3">
                              <div className="flex-1 space-y-1">
                                <Label className="text-xs">Date et heure</Label>
                                <Input
                                  type="datetime-local"
                                  value={editScheduledAt}
                                  onChange={(e) => setEditScheduledAt(e.target.value)}
                                />
                              </div>
                              <Button
                                size="sm"
                                className="text-xs h-9"
                                onClick={handleSchedule}
                                disabled={scheduling === contrib.id || !editScheduledAt}
                              >
                                {scheduling === contrib.id ? "..." : "Programmer"}
                              </Button>
                              {contrib.status === "programme" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs h-9"
                                  onClick={() => handleCancelSchedule(contrib.id)}
                                  disabled={scheduling === contrib.id}
                                  title="Annuler la programmation (repasse en brouillon)"
                                >
                                  Annuler
                                </Button>
                              )}
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

      <DeleteConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        itemLabel={`l'opinion « ${deleteTarget?.title ?? ""} »`}
        onConfirm={handleDeleteConfirmed}
      />
    </div>
  );
}
