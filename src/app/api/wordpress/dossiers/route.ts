import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function wpFetch(path: string, options?: RequestInit) {
  const wpUrl = process.env.WORDPRESS_API_URL;
  const wpUser = process.env.WORDPRESS_USERNAME;
  const wpPass = process.env.WORDPRESS_APP_PASSWORD;
  const credentials = Buffer.from(`${wpUser}:${wpPass}`).toString("base64");

  return fetch(`${wpUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${credentials}`,
      ...options?.headers,
    },
  });
}

// GET: list dossiers (category Dossiers, WITHOUT tag contributions)
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const authorId = searchParams.get("author_id");
  const categoryId = process.env.WORDPRESS_DOSSIERS_CATEGORY_ID || "1";
  const excludeTagId = process.env.WORDPRESS_CONTRIBUTIONS_TAG_ID || "24";

  let url = `/posts?categories=${categoryId}&tags_exclude=${excludeTagId}&per_page=100&status=draft,publish&context=edit`;
  if (authorId) {
    url += `&author=${authorId}`;
  }

  try {
    const res = await wpFetch(url);
    if (!res.ok) {
      return NextResponse.json({ error: "Erreur WordPress" }, { status: 502 });
    }
    const posts = await res.json();

    // Fetch featured images
    const mediaIds = posts
      .map((p: Record<string, unknown>) => p.featured_media)
      .filter((id: unknown) => id && id !== 0);

    let mediaMap: Record<number, string> = {};
    if (mediaIds.length > 0) {
      const uniqueIds = [...new Set(mediaIds as number[])];
      const mediaRes = await wpFetch(`/media?include=${uniqueIds.join(",")}&per_page=100`);
      if (mediaRes.ok) {
        const mediaList = await mediaRes.json();
        for (const m of mediaList) {
          const thumb = m.media_details?.sizes?.thumbnail?.source_url || m.source_url;
          mediaMap[m.id] = thumb;
        }
      }
    }

    const dossiers = posts.map((p: Record<string, unknown>) => ({
      id: p.id,
      title: (p.title as Record<string, string>)?.raw || (p.title as Record<string, string>)?.rendered || "",
      content: (p.content as Record<string, string>)?.raw || (p.content as Record<string, string>)?.rendered || "",
      status: p.status,
      author: p.author,
      date: p.date,
      link: p.link,
      image: mediaMap[(p.featured_media as number) || 0] || "",
    }));

    return NextResponse.json(dossiers);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur" },
      { status: 502 }
    );
  }
}

// POST: create dossier
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await request.json();
  const categoryId = parseInt(process.env.WORDPRESS_DOSSIERS_CATEGORY_ID || "1", 10);

  if (!body.title) {
    return NextResponse.json({ error: "Titre requis" }, { status: 400 });
  }

  try {
    const postData: Record<string, unknown> = {
      title: body.title,
      content: body.content || "",
      status: "draft",
      categories: [categoryId],
    };
    if (body.author_id) postData.author = body.author_id;

    const res = await wpFetch("/posts", {
      method: "POST",
      body: JSON.stringify(postData),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: 502 });
    }

    const post = await res.json();
    return NextResponse.json({
      id: post.id,
      title: post.title?.raw || post.title?.rendered || "",
      link: post.link,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur" },
      { status: 502 }
    );
  }
}

// PUT: update dossier
export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await request.json();

  if (!body.id) {
    return NextResponse.json({ error: "ID requis" }, { status: 400 });
  }

  try {
    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.content !== undefined) updateData.content = body.content;
    if (body.status !== undefined) updateData.status = body.status;

    const res = await wpFetch(`/posts/${body.id}`, {
      method: "POST",
      body: JSON.stringify(updateData),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: 502 });
    }

    const post = await res.json();
    return NextResponse.json({
      id: post.id,
      status: post.status,
      link: post.link,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur" },
      { status: 502 }
    );
  }
}
