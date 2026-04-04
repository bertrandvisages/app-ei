import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { articleId } = await request.json();

  const { data: article, error: articleError } = await supabase
    .from("articles")
    .select("*")
    .eq("id", articleId)
    .single();

  if (articleError || !article) {
    return NextResponse.json({ error: "Article non trouvé" }, { status: 404 });
  }

  if (article.status !== "valide" && article.status !== "draft") {
    return NextResponse.json(
      { error: "L'article ne peut pas être publié" },
      { status: 400 }
    );
  }

  const wpUrl = process.env.WORDPRESS_API_URL;
  const wpUser = process.env.WORDPRESS_USERNAME;
  const wpPass = process.env.WORDPRESS_APP_PASSWORD;

  if (!wpUrl || !wpUser || !wpPass) {
    return NextResponse.json(
      { error: "Configuration WordPress manquante" },
      { status: 500 }
    );
  }

  const credentials = Buffer.from(`${wpUser}:${wpPass}`).toString("base64");

  try {
    const wpResponse = await fetch(`${wpUrl}/posts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify({
        title: article.title,
        content: article.content || "",
        status: "publish",
        categories: [parseInt(process.env.WORDPRESS_CATEGORY_ID || "11", 10)],
        tags: [parseInt(process.env.WORDPRESS_TAG_ID || "20", 10)],
      }),
    });

    if (!wpResponse.ok) {
      const wpError = await wpResponse.text();
      return NextResponse.json(
        { error: `Erreur WordPress: ${wpError}` },
        { status: 502 }
      );
    }

    const wpPost = await wpResponse.json();

    await supabase
      .from("articles")
      .update({
        status: "publie",
        wordpress_post_id: wpPost.id,
        wordpress_url: wpPost.link,
        published_by: user.id,
      })
      .eq("id", articleId);

    return NextResponse.json({
      postId: wpPost.id,
      postUrl: wpPost.link,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: `Erreur de connexion WordPress: ${err instanceof Error ? err.message : "Inconnue"}`,
      },
      { status: 502 }
    );
  }
}
