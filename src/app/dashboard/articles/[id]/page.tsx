import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ArticleEditor } from "@/components/article-editor";
import type { Article, Profile } from "@/lib/types";

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: article } = await supabase
    .from("articles")
    .select("*")
    .eq("id", id)
    .single();

  if (!article) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single();

  return (
    <ArticleEditor
      article={article as Article}
      profile={profile as Profile}
    />
  );
}
