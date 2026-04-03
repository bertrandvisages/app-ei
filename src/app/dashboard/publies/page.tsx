import { createClient } from "@/lib/supabase/server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Article } from "@/lib/types";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function PubliesPage() {
  const supabase = await createClient();

  const { data: articles } = await supabase
    .from("articles")
    .select("*")
    .eq("status", "publie")
    .order("updated_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Articles publiés</h1>
        <p className="text-muted-foreground">
          Articles envoyés sur WordPress
        </p>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[400px]">Titre</TableHead>
              <TableHead>Secteur</TableHead>
              <TableHead>WordPress ID</TableHead>
              <TableHead>Publié le</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(!articles || articles.length === 0) ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Aucun article publié
                </TableCell>
              </TableRow>
            ) : (
              (articles as Article[]).map((article) => (
                <TableRow key={article.id}>
                  <TableCell className="font-medium">{article.titre}</TableCell>
                  <TableCell>
                    {article.secteur && (
                      <Badge variant="outline">{article.secteur}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {article.wordpress_post_id || "-"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(article.updated_at).toLocaleDateString("fr-FR")}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    {article.wordpress_url && (
                      <a
                        href={article.wordpress_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="outline" size="sm">
                          Voir sur WP
                        </Button>
                      </a>
                    )}
                    <Link href={`/dashboard/articles/${article.id}`}>
                      <Button variant="ghost" size="sm">
                        Détails
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
