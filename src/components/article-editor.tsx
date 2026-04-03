"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import type { Article, Profile } from "@/lib/types";

const statusLabels: Record<string, string> = {
  brouillon: "Brouillon",
  valide: "Validé",
  publie: "Publié",
  rejete: "Rejeté",
};

const statusColors: Record<string, string> = {
  brouillon: "bg-yellow-100 text-yellow-800",
  valide: "bg-blue-100 text-blue-800",
  publie: "bg-green-100 text-green-800",
  rejete: "bg-red-100 text-red-800",
};

export function ArticleEditor({
  article: initialArticle,
  profile,
}: {
  article: Article;
  profile: Profile;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [article, setArticle] = useState(initialArticle);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("articles")
      .update({
        titre: article.titre,
        description: article.description,
        link: article.link,
        url: article.url,
        secteur: article.secteur,
      })
      .eq("id", article.id);

    if (error) {
      toast.error("Erreur lors de la sauvegarde");
    } else {
      toast.success("Article sauvegardé");
    }
    setSaving(false);
  };

  const handleStatusChange = async (
    newStatus: "valide" | "rejete" | "brouillon"
  ) => {
    const updateData: Record<string, unknown> = { status: newStatus };
    if (newStatus === "valide") {
      updateData.validated_by = profile.id;
    }

    const { error } = await supabase
      .from("articles")
      .update(updateData)
      .eq("id", article.id);

    if (error) {
      toast.error("Erreur lors du changement de statut");
    } else {
      setArticle({ ...article, status: newStatus });
      toast.success(`Article marqué comme ${statusLabels[newStatus]}`);
    }
  };

  const handlePublishToWordPress = async () => {
    setPublishing(true);
    try {
      const res = await fetch("/api/wordpress/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId: article.id }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setArticle({
        ...article,
        status: "publie",
        wordpress_post_id: data.postId,
        wordpress_url: data.postUrl,
      });
      toast.success("Article publié sur WordPress !");
    } catch (err) {
      toast.error(
        `Erreur: ${err instanceof Error ? err.message : "Publication échouée"}`
      );
    }
    setPublishing(false);
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => router.push("/dashboard")}>
            &larr; Retour
          </Button>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[article.status]}`}
          >
            {statusLabels[article.status]}
          </span>
        </div>
        <div className="flex gap-2">
          {article.status === "brouillon" && (
            <>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleStatusChange("rejete")}
              >
                Rejeter
              </Button>
              <Button
                size="sm"
                onClick={() => handleStatusChange("valide")}
              >
                Valider
              </Button>
            </>
          )}
          {article.status === "rejete" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStatusChange("brouillon")}
            >
              Remettre en brouillon
            </Button>
          )}
          {article.status === "valide" && (
            <Button
              size="sm"
              onClick={handlePublishToWordPress}
              disabled={publishing}
            >
              {publishing ? "Publication..." : "Publier sur WordPress"}
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Éditer l&apos;article</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titre">Titre</Label>
            <Input
              id="titre"
              value={article.titre}
              onChange={(e) =>
                setArticle({ ...article, titre: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={6}
              value={article.description || ""}
              onChange={(e) =>
                setArticle({ ...article, description: e.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="secteur">Secteur</Label>
              <Input
                id="secteur"
                value={article.secteur || ""}
                onChange={(e) =>
                  setArticle({ ...article, secteur: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date_source">Date source</Label>
              <Input
                id="date_source"
                type="date"
                value={
                  article.date_source
                    ? new Date(article.date_source).toISOString().split("T")[0]
                    : ""
                }
                readOnly
                className="bg-muted"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="link">Lien source</Label>
            <Input
              id="link"
              value={article.link || ""}
              onChange={(e) =>
                setArticle({ ...article, link: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="url">URL</Label>
            <Input
              id="url"
              value={article.url || ""}
              onChange={(e) =>
                setArticle({ ...article, url: e.target.value })
              }
            />
          </div>

          <Separator />

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => router.push("/dashboard")}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Sauvegarde..." : "Sauvegarder"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* WordPress info */}
      {article.wordpress_post_id && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">WordPress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">
              <span className="text-muted-foreground">Post ID:</span>{" "}
              {article.wordpress_post_id}
            </p>
            {article.wordpress_url && (
              <p className="text-sm">
                <span className="text-muted-foreground">URL:</span>{" "}
                <a
                  href={article.wordpress_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  {article.wordpress_url}
                </a>
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
