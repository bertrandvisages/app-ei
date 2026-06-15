import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateSlug } from "@/lib/slug";
import { deleteStorageObjectByPublicUrl } from "@/lib/storage";
import { decodeEntities } from "@/lib/utils";

type DossierRow = {
  id: string;
  wp_id: number | null;
  slug: string;
  title: string;
  description: string | null;
  excerpt: string | null;
  cover_image_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
  author_id: string | null;
  sort_order: number;
  status: "draft" | "programme" | "publie" | "archive";
  published_at: string | null;
  scheduled_publish_at: string | null;
  created_at: string;
  updated_at: string;
};

const SELECT_COLS =
  "id, wp_id, slug, title, description, excerpt, cover_image_url, seo_title, seo_description, author_id, sort_order, status, published_at, scheduled_publish_at, created_at, updated_at";

function isModifiedSincePublish(d: DossierRow): boolean {
  if (d.status !== "publie" || !d.published_at || !d.updated_at) return false;
  return new Date(d.updated_at).getTime() > new Date(d.published_at).getTime() + 2000;
}

// Map Supabase row → shape attendue (rétrocompat WP API)
function toApiShape(d: DossierRow) {
  return {
    id: d.id,
    title: decodeEntities(d.title),
    content: d.description ?? "",
    status: d.status === "publie" ? "publish" : d.status,
    is_modified: isModifiedSincePublish(d),
    author: d.author_id,
    date: d.published_at ?? d.created_at,
    created_at: d.created_at,
    updated_at: d.updated_at,
    scheduled_publish_at: d.scheduled_publish_at,
    link: "",
    slug: d.slug,
    image: d.cover_image_url ?? "",
    image_id: null,
    seo_title: d.seo_title ?? "",
    seo_description: d.seo_description ?? "",
    sort_order: d.sort_order,
  };
}

// GET : liste des dossiers (filtre optionnel author_id)
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
    .from("dossiers")
    .select(
      SELECT_COLS
    )
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (authorId) {
    query = query.eq("author_id", authorId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json((data as DossierRow[]).map(toApiShape));
}

// POST : création
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await request.json();
  if (!body.title) {
    return NextResponse.json({ error: "Titre requis" }, { status: 400 });
  }

  const slug = generateSlug(body.title);

  const insertPayload = {
    slug,
    title: body.title,
    description: body.content ?? null,
    author_id: body.author_id ?? null,
    status: "draft" as const,
  };

  const { data, error } = await supabase
    .from("dossiers")
    .insert(insertPayload)
    .select(
      SELECT_COLS
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(toApiShape(data as DossierRow));
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
  if (body.content !== undefined) updatePayload.description = body.content;
  // Si on remplace la cover, on récupère l'ancienne URL pour la supprimer
  // du Storage après le UPDATE (best-effort, voir lib/storage.ts).
  let previousCoverUrl: string | null = null;
  if (body.cover_image_url !== undefined) {
    updatePayload.cover_image_url = body.cover_image_url;
    const { data: current } = await supabase
      .from("dossiers")
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
  if (body.author_id !== undefined) updatePayload.author_id = body.author_id;
  if (body.sort_order !== undefined) updatePayload.sort_order = body.sort_order;
  // Champs SEO : on stocke null si l'éditeur vide la case pour activer
  // le fallback côté site Astro (qui retombe sur title/excerpt si null).
  if (body.seo_title !== undefined)
    updatePayload.seo_title = body.seo_title || null;
  if (body.seo_description !== undefined)
    updatePayload.seo_description = body.seo_description || null;
  if (body.status !== undefined) {
    const s = body.status === "publish" ? "publie" : body.status;
    updatePayload.status = s;
    if (s === "publie") {
      updatePayload.published_at = new Date().toISOString();
      // Sortir du status "programme" → on efface la date programmée
      updatePayload.scheduled_publish_at = null;
    } else if (s === "programme") {
      // Programmation : il faut une date dans le futur
      if (!body.scheduled_publish_at) {
        return NextResponse.json(
          { error: "scheduled_publish_at requis pour programmer" },
          { status: 400 }
        );
      }
      updatePayload.scheduled_publish_at = body.scheduled_publish_at;
    } else if (s === "draft") {
      // Repassage en brouillon → on efface la date programmée
      updatePayload.scheduled_publish_at = null;
    }
  } else if (body.scheduled_publish_at !== undefined) {
    // Modification de la date programmée sans changement de status
    // (ex. l'éditeur ajuste l'heure d'un post déjà en status=programme)
    updatePayload.scheduled_publish_at = body.scheduled_publish_at || null;
  }

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ success: true });
  }

  const { error } = await supabase
    .from("dossiers")
    .update(updatePayload)
    .eq("id", body.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (previousCoverUrl) {
    await deleteStorageObjectByPublicUrl(supabase, previousCoverUrl);
  }

  // Rebuild Astro déclenché manuellement via le bouton "Mettre à jour le site"
  // (route /api/wordpress/deploy), pour permettre de batcher plusieurs publications.

  return NextResponse.json({ success: true });
}

// DELETE : suppression (editeur et admin autorises, confirmation cote UI)
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID requis" }, { status: 400 });
  }

  const { error } = await supabase.from("dossiers").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
