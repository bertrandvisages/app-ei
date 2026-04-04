"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  articles,
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
  const totalPages = Math.ceil(totalCount / pageSize);

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    router.push(`/dashboard?${params.toString()}`);
  };

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", page.toString());
    router.push(`/dashboard?${params.toString()}`);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select
          value={currentStatus || "all"}
          onValueChange={(v: string | null) => updateFilter("status", !v || v === "all" ? "" : v)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrer par statut" />
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
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrer par catégorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les catégories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={currentSource || "all"}
          onValueChange={(v: string | null) => updateFilter("source", !v || v === "all" ? "" : v)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrer par source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les sources</SelectItem>
            {sources.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[400px]">Titre</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Catégories</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {articles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Aucun article trouvé
                </TableCell>
              </TableRow>
            ) : (
              articles.map((article) => (
                <TableRow key={article.id}>
                  <TableCell>
                    <p className="font-medium line-clamp-1">{article.title}</p>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {article.source_name || "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {article.categories?.map((cat) => (
                        <Badge key={cat} variant="outline" className="text-xs">
                          {cat}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {article.date_source
                      ? new Date(article.date_source).toLocaleDateString("fr-FR")
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${statusColors[article.status]}`}
                    >
                      {statusLabels[article.status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/dashboard/articles/${article.id}`}>
                      <Button variant="ghost" size="sm">
                        Voir
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {totalCount} article{totalCount > 1 ? "s" : ""} au total
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
