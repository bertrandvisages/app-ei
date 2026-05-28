import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateSlug } from "@/lib/slug";
import { triggerLenoncoteRebuild } from "@/lib/trigger-deploy";
import { deleteStorageObjectByPublicUrl } from "@/lib/storage";

type ContribRow = {
  id: string;
  wp_id: number | null;
  dossier_id: string | null;
  author_id: string | null;
  slug: string;
  title: string;
  content: string | null;
  excerpt: string | null;
  citation: string | null;
  cover_image_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
  status: "draft" | "publie" | "archive";
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

const SELECT_COLS =
  "id, wp_id, dossier_id, author_id, slug, title, content, excerpt, citation, cover_image_url, seo_title, seo_description, status, published_at, created_at, updated_at";

// Modifié = publié mais updated_at postérieur à published_at (tolérance 2s)
function isModifiedSincePublish(c: ContribRow): boolean {
  if (c.status !== "publie" || !c.published_at || !c.updated_at) return false;
  return new Date(c.updated_at).getTime() > new Date(c.published_at).getTime() + 2000;
}

// Map Supabase row → shape attendue par le dashboard (rétrocompat WP API)
function toApiShape(c: ContribRow) {
  return {
    id: c.id,
    title: c.title,
    content: c.content ?? "",
    citation: c.citation ?? "",
    status: c.status === "publie" ? "publish" : c.status, // map publié vers vocabulaire WP du front
    is_modified: isModifiedSincePublish(c),
    author: c.author_id,
    date: c.published_at ?? c.created_at,
    link: "",
    slug: c.slug,
    image: c.cover_image_url ?? "",
    image_id: null,
    seo_title: c.seo_title ?? "",
    seo_description: c.seo_description ?? "",
  };
}

// GET : liste des contributions (filtre optionnel author_id)
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const authorId = searchParams.get("author_id");

  let query = supabase
    .from("contributions")
    .select(
      SELECT_COLS
    )
    .order("created_at", { ascending: false });

  if (authorId) {
    query = query.eq("author_id", authorId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json((data as ContribRow[]).map(toApiShape));
}

// POST : création d'une contribution
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await request.json();

  if (!body.title || !body.author_id) {
    return NextResponse.json({ error: "Titre et auteur requis" }, { status: 400 });
  }

  const slug = generateSlug(body.title);

  const insertPayload = {
    slug,
    title: body.title,
    content: body.content ?? null,
    citation: body.citation ?? null,
    author_id: String(body.author_id),
    dossier_id: body.dossier_id ?? null,
    status: "draft" as const,
  };

  const { data, error } = await supabase
    .from("contributions")
    .insert(insertPayload)
    .select(
      SELECT_COLS
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(toApiShape(data as ContribRow));
}

// PUT : mise à jour
export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await request.json();
  if (!body.id) {
    return NextResponse.json({ error: "ID requis" }, { status: 400 });
  }

  const updatePayload: Record<string, unknown> = {};
  if (body.title !== undefined) updatePayload.title = body.title;
  if (body.content !== undefined) updatePayload.content = body.content;
  if (body.citation !== undefined) updatePayload.citation = body.citation;
  // Si on remplace la cover, on récupère l'ancienne URL pour la supprimer
  // du Storage après le UPDATE (best-effort, voir lib/storage.ts).
  let previousCoverUrl: string | null = null;
  if (body.cover_image_url !== undefined) {
    updatePayload.cover_image_url = body.cover_image_url;
    const { data: current } = await supabase
      .from("contributions")
      .select("cover_image_url")
      .eq("id", body.id)
      .single();
    if (
      current?.cover_image_url &&
      current.cover_image_url !== body.cover_image_url
    ) {
      previousCoverUrl = current.cover_image_url;
    }
  }
  if (body.dossier_id !== undefined) updatePayload.dossier_id = body.dossier_id;
  if (body.author_id !== undefined) updatePayload.author_id = body.author_id;
  // Champs SEO : on stocke null si l'éditeur vide la case pour activer
  // le fallback côté site Astro (qui retombe sur title/citation/excerpt si null).
  if (body.seo_title !== undefined)
    updatePayload.seo_title = body.seo_title || null;
  if (body.seo_description !== undefined)
    updatePayload.seo_description = body.seo_description || null;
  let willBePublished = false;
  if (body.status !== undefined) {
    // Map: front peut envoyer 'publish' (vocab WP) → on stocke 'publie'
    const s = body.status === "publish" ? "publie" : body.status;
    updatePayload.status = s;
    if (s === "publie") {
      updatePayload.published_at = new Date().toISOString();
      willBePublished = true;
    }
  }

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ success: true });
  }

  const { error } = await supabase
    .from("contributions")
    .update(updatePayload)
    .eq("id", body.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (previousCoverUrl) {
    await deleteStorageObjectByPublicUrl(supabase, previousCoverUrl);
  }

  if (willBePublished) {
    triggerLenoncoteRebuild();
  }

  return NextResponse.json({ success: true });
}

// DELETE : suppression
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID requis" }, { status: 400 });
  }

  const { error } = await supabase.from("contributions").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
