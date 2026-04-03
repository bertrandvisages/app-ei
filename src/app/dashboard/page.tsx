import { createClient } from "@/lib/supabase/server";
import { ArticlesTable } from "@/components/articles-table";
import type { Article } from "@/lib/types";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; secteur?: string; page?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const status = params.status || "";
  const secteur = params.secteur || "";
  const page = parseInt(params.page || "1", 10);
  const pageSize = 20;

  let query = supabase
    .from("articles")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (status) query = query.eq("status", status);
  if (secteur) query = query.eq("secteur", secteur);

  const { data: articles, count } = await query;

  // Get distinct secteurs for filter
  const { data: secteursData } = await supabase
    .from("articles")
    .select("secteur")
    .not("secteur", "is", null);

  const secteurs = [
    ...new Set(secteursData?.map((s) => s.secteur).filter(Boolean)),
  ] as string[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Articles</h1>
        <p className="text-muted-foreground">
          Gérez les actualités récupérées par le flux n8n
        </p>
      </div>
      <ArticlesTable
        articles={(articles as Article[]) || []}
        totalCount={count || 0}
        currentPage={page}
        pageSize={pageSize}
        currentStatus={status}
        currentSecteur={secteur}
        secteurs={secteurs}
      />
    </div>
  );
}
