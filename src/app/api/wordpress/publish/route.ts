import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { triggerLenoncoteRebuild } from "@/lib/trigger-deploy";

// Publie un article : passe le status à 'publie' dans Supabase.
// La diffusion sur le site public (Astro) sera gérée en Phase 5.
export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { articleId } = await request.json();
  if (!articleId) {
    return NextResponse.json({ error: "articleId requis" }, { status: 400 });
  }

  const { data: article, error: articleError } = await supabase
    .from("articles")
    .select("id, status")
    .eq("id", articleId)
    .single();

  if (articleError || !article) {
    return NextResponse.json({ error: "Article non trouvé" }, { status: 404 });
  }

  if (article.status !== "valide" && article.status !== "draft") {
    return NextResponse.json(
      { error: "L'article ne peut pas être publié dans son état actuel" },
      { status: 400 }
    );
  }

  const { error: updateError } = await supabase
    .from("articles")
    .update({
      status: "publie",
      published_by: user.id,
    })
    .eq("id", articleId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Fire-and-forget : on déclenche le rebuild Astro sans attendre la réponse
  triggerLenoncoteRebuild();

  return NextResponse.json({ success: true, articleId });
}
