import { createClient } from "@/lib/supabase/server";
import { ArticlesTable } from "@/components/articles-table";
import type { Article } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string; source?: string; page?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const status = params.status || "";
  const category = params.category || "";
  const source = params.source || "";
  const page = parseInt(params.page || "1", 10);
  const pageSize = 100;

  let query = supabase
    .from("articles")
    .select("*", { count: "exact" })
    .neq("status", "publie")
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (status) query = query.eq("status", status);
  if (category) query = query.contains("categories", [category]);
  if (source) query = query.eq("source_name", source);

  const { data: articles, count } = await query;

  // Get distinct sources for filter
  const { data: sourcesData } = await supabase
    .from("articles")
    .select("source_name")
    .not("source_name", "is", null);

  const sources = [
    ...new Set(sourcesData?.map((s) => s.source_name).filter(Boolean)),
  ] as string[];

  // Get distinct categories
  const { data: catData } = await supabase
    .from("articles")
    .select("categories");

  const categories = [
    ...new Set(catData?.flatMap((c) => c.categories || []).filter(Boolean)),
  ] as string[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Actualités</h1>
        <p className="text-muted-foreground">
          Gérez les actualités du site lenoncote.fr
        </p>
      </div>
      <ArticlesTable
        articles={(articles as Article[]) || []}
        totalCount={count || 0}
        currentPage={page}
        pageSize={pageSize}
        currentStatus={status}
        currentCategory={category}
        currentSource={source}
        categories={categories}
        sources={sources}
      />
    </div>
  );
}
