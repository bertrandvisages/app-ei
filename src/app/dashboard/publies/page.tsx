"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { Article } from "@/lib/types";

export default function PubliesPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Article | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("articles")
        .select("*")
        .eq("status", "publie")
        .order("updated_at", { ascending: false });

      setArticles((data as Article[]) || []);
      setLoading(false);
    }
    load();
  }, []);

  const toggleExpand = (article: Article) => {
    if (expandedId === article.id) {
      setExpandedId(null);
      setEditData(null);
    } else {
      setExpandedId(article.id);
      setEditData({ ...article });
    }
  };

  const handleSave = async () => {
    if (!editData) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("articles")
      .update({
        title: editData.title,
        content: editData.content,
        source_url: editData.source_url,
        source_name: editData.source_name,
      })
      .eq("id", editData.id);

    if (error) {
      toast.error("Erreur lors de la sauvegarde");
    } else {
      setArticles(articles.map((a) => (a.id === editData.id ? editData : a)));
      toast.success("Sauvegardé");
    }
    setSaving(false);
  };

  const handleDelete = async (article: Article) => {
    const confirmed = window.confirm(
      `Supprimer "${article.title}" ?\n\nCette action supprimera l'article de Supabase et de WordPress.`
    );
    if (!confirmed) return;

    setDeleting(article.id);

    // Delete from WordPress if we have the post ID
    if (article.wordpress_post_id) {
      try {
        await fetch("/api/wordpress/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId: article.wordpress_post_id }),
        });
      } catch {
        // Continue even if WP delete fails
      }
    }

    // Delete from Supabase
    const supabase = createClient();
    const { error } = await supabase
      .from("articles")
      .delete()
      .eq("id", article.id);

    if (error) {
      toast.error("Erreur lors de la suppression");
    } else {
      setArticles(articles.filter((a) => a.id !== article.id));
      if (expandedId === article.id) {
        setExpandedId(null);
        setEditData(null);
      }
      toast.success("Article supprimé");
    }
    setDeleting(null);
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
      <div>
        <h1 className="text-2xl font-bold">Actualités publiées</h1>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead>Titre</TableHead>
              <TableHead className="w-[120px]">Source</TableHead>
              <TableHead className="w-[100px]">Publié le</TableHead>
              <TableHead className="w-[180px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {articles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  Aucune actualité publiée
                </TableCell>
              </TableRow>
            ) : (
              articles.map((article) => (
                <>
                  <TableRow
                    key={article.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleExpand(article)}
                  >
                    <TableCell className="text-muted-foreground">
                      <svg
                        className={`h-4 w-4 transition-transform ${expandedId === article.id ? "rotate-90" : ""}`}
                        fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-sm line-clamp-1">{article.title}</p>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {article.source_name || "-"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(article.updated_at).toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1 justify-end">
                        {article.wordpress_url && (
                          <a href={article.wordpress_url} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm" className="text-xs h-7">
                              Voir sur le site
                            </Button>
                          </a>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          className="text-xs h-7"
                          onClick={() => handleDelete(article)}
                          disabled={deleting === article.id}
                        >
                          {deleting === article.id ? "..." : "Supprimer"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>

                  {expandedId === article.id && editData && (
                    <TableRow key={`${article.id}-expanded`}>
                      <TableCell colSpan={5} className="bg-muted/30 p-0">
                        <div className="p-5 space-y-4">
                          <div className="space-y-2">
                            <Label className="text-xs font-medium text-muted-foreground">Titre</Label>
                            <Input
                              value={editData.title}
                              onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-medium text-muted-foreground">Contenu</Label>
                            <Textarea
                              rows={5}
                              value={editData.content || ""}
                              onChange={(e) => setEditData({ ...editData, content: e.target.value })}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-xs font-medium text-muted-foreground">Source</Label>
                              <Input
                                value={editData.source_name || ""}
                                onChange={(e) => setEditData({ ...editData, source_name: e.target.value })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs font-medium text-muted-foreground">URL source</Label>
                              <Input
                                value={editData.source_url || ""}
                                onChange={(e) => setEditData({ ...editData, source_url: e.target.value })}
                              />
                            </div>
                          </div>
                          {article.wordpress_post_id && (
                            <p className="text-xs text-muted-foreground">
                              WordPress Post ID : {article.wordpress_post_id}
                            </p>
                          )}
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => { setExpandedId(null); setEditData(null); }}>
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
