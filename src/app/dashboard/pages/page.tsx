"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface PageRow {
  slug: string;
  title: string;
  description: string;
  url: string;
  status: string;
  updated_at: string | null;
}

export default function PagesListPage() {
  const [pages, setPages] = useState<PageRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/pages")
      .then((r) => r.json())
      .then((data: PageRow[]) => setPages(data))
      .catch(() => setPages([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Pages statiques</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Édite les textes des pages du site (titres, intro, FAQ, SEO). La
          structure (cards, tableaux, layout) reste codée — seuls les libellés
          sont éditables ici.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : (
        <div className="space-y-3">
          {pages.map((p) => (
            <Card key={p.slug}>
              <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
                <div className="flex-1">
                  <CardTitle className="text-base">{p.title}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    {p.description}
                  </p>
                </div>
                {p.status === "non-edite" ? (
                  <Badge variant="secondary" className="text-xs">
                    Jamais édité
                  </Badge>
                ) : (
                  <Badge className="text-xs bg-emerald-600 hover:bg-emerald-700">
                    Édité
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="flex items-center justify-between pt-0 text-xs text-muted-foreground">
                <div className="flex items-center gap-3">
                  <span className="font-mono">{p.url}</span>
                  {p.updated_at && (
                    <span>
                      · Mis à jour le{" "}
                      {new Date(p.updated_at).toLocaleDateString("fr-FR")}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <a
                    href={`https://lenoncote.fr${p.url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    Voir
                  </a>
                  <Link
                    href={`/dashboard/pages/${p.slug}`}
                    className={buttonVariants({ size: "sm" })}
                  >
                    Éditer
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
