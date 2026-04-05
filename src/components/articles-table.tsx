"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { Article } from "@/lib/types";

const statusColors: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800 border-yellow-200",
  valide: "bg-blue-100 text-blue-800 border-blue-200",
  publie: "bg-green-100 text-green-800 border-green-200",
  rejete: "bg-red-100 text-red-800 border-red-200",
};

const statusLabels: Record<string, string> = {
  draft: "Brouillon",
  valide: "Validé",
  publie: "Publié",
  rejete: "Rejeté",
};

interface ArticlesTableProps {
  articles: Article[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  currentStatus: string;
  currentCategory: string;
  currentSource: string;
  categories: string[];
  sources: string[];
}

export function ArticlesTable({
  articles: initialArticles,
  totalCount,
  currentPage,
  pageSize,
  currentStatus,
  currentCategory,
  currentSource,
  categories,
  sources,
}: ArticlesTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const totalPages = Math.ceil(totalCount / pageSize);

  const [articles, setArticles] = useState(initialArticles);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Article | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState<string | null>(null);

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    window.location.href = `/dashboard?${params.toString()}`;
  };

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", page.toString());
    window.location.href = `/dashboard?${params.toString()}`;
  };

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

  const handleStatusChange = async (id: string, newStatus: "valide" | "rejete" | "draft") => {
    const { error } = await supabase
      .from("articles")
      .update({ status: newStatus })
      .eq("id", id);

    if (error) {
      toast.error("Erreur");
    } else {
      setArticles(articles.map((a) => (a.id === id ? { ...a, status: newStatus } : a)));
      if (editData?.id === id) setEditData({ ...editData, status: newStatus });
      toast.success(`Article ${statusLabels[newStatus].toLowerCase()}`);
    }
  };

  const handlePublish = async (id: string) => {
    setPublishing(id);
    try {
      const res = await fetch("/api/wordpress/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success("Publié sur WordPress");
      // Refresh page to get updated server data
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur de publication");
    }
    setPublishing(null);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("articles").delete().eq("id", id);
    if (error) {
      toast.error("Erreur lors de la suppression");
    } else {
      setArticles(articles.filter((a) => a.id !== id));
      if (expandedId === id) {
        setExpandedId(null);
        setEditData(null);
      }
      toast.success("Article supprimé");
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select
          value={currentStatus || "all"}
          onValueChange={(v: string | null) => updateFilter("status", !v || v === "all" ? "" : v)}
        >
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="draft">Brouillon</SelectItem>
            <SelectItem value="valide">Validé</SelectItem>
            <SelectItem value="publie">Publié</SelectItem>
            <SelectItem value="rejete">Rejeté</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={currentCategory || "all"}
          onValueChange={(v: string | null) => updateFilter("category", !v || v === "all" ? "" : v)}
        >
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes catégories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={currentSource || "all"}
          onValueChange={(v: string | null) => updateFilter("source", !v || v === "all" ? "" : v)}
        >
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes sources</SelectItem>
            {sources.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead>Titre</TableHead>
              <TableHead className="w-[120px]">Source</TableHead>
              <TableHead className="w-[100px]">Date</TableHead>
              <TableHead className="w-[140px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {articles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  Aucun article trouvé
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
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
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
                      {article.date_source
                        ? new Date(article.date_source).toLocaleDateString("fr-FR")
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1 justify-end">
                        {(article.status === "draft" || article.status === "valide") && (
                          <Button
                            size="sm"
                            className="text-xs h-7 bg-[#E35205] hover:bg-[#c44604]"
                            onClick={() => handlePublish(article.id)}
                            disabled={publishing === article.id}
                          >
                            {publishing === article.id ? "..." : "Publier"}
                          </Button>
                        )}
                        {article.status !== "publie" && (
                          <Button
                            size="sm"
                            variant="destructive"
                            className="text-xs h-7"
                            onClick={() => handleDelete(article.id)}
                          >
                            Supprimer
                          </Button>
                        )}
                      </div>
                      {article.status === "publie" && (
                        <span className="text-xs text-green-600 font-medium">Publié</span>
                      )}
                    </TableCell>
                  </TableRow>

                  {/* Expanded row */}
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
                          <div className="flex gap-2 flex-wrap">
                            {editData.categories?.map((cat) => (
                              <Badge key={cat} variant="secondary" className="text-xs">{cat}</Badge>
                            ))}
                            {editData.tags?.map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                            ))}
                          </div>
                          {editData.source_url && (
                            <a
                              href={editData.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-[#E35205] hover:underline"
                            >
                              Voir l&apos;article original &rarr;
                            </a>
                          )}
                          <div className="flex items-center justify-between pt-2 border-t">
                            <div className="flex gap-2">
                              {(editData.status === "draft" || editData.status === "valide") && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="text-xs h-7"
                                    onClick={() => handleStatusChange(editData.id, "rejete")}
                                  >
                                    Rejeter
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="text-xs h-7 bg-[#E35205] hover:bg-[#c44604]"
                                    onClick={() => handlePublish(editData.id)}
                                    disabled={publishing === editData.id}
                                  >
                                    {publishing === editData.id ? "Publication..." : "Publier sur WordPress"}
                                  </Button>
                                </>
                              )}
                              {editData.status === "rejete" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs h-7"
                                    onClick={() => handleStatusChange(editData.id, "draft")}
                                  >
                                    Remettre en brouillon
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="text-xs h-7"
                                    onClick={() => handleDelete(editData.id)}
                                  >
                                    Supprimer
                                  </Button>
                                </>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7"
                              onClick={handleSave}
                              disabled={saving}
                            >
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {totalCount} article{totalCount > 1 ? "s" : ""}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
            >
              Précédent
            </Button>
            <span className="flex items-center text-sm px-2">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
            >
              Suivant
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
