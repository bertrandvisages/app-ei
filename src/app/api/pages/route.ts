import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { triggerLenoncoteRebuild } from "@/lib/trigger-deploy";
import { PAGE_SCHEMAS } from "@/lib/page-schemas";

// GET /api/pages?slug=vos-droits  → contenu actuel d'une page
// GET /api/pages                  → liste des slugs avec leur status
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");

  if (slug) {
    if (!PAGE_SCHEMAS[slug]) {
      return NextResponse.json({ error: "Page inconnue" }, { status: 404 });
    }
    const { data, error } = await supabase
      .from("pages")
      .select("slug, content, seo_title, seo_description, status, published_at, updated_at")
      .eq("slug", slug)
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    // Si la page n'a jamais été éditée, on renvoie une coquille vide pour
    // que le formulaire affiche ses placeholders sans 404.
    return NextResponse.json(
      data ?? {
        slug,
        content: {},
        seo_title: null,
        seo_description: null,
        status: "publie",
        published_at: null,
        updated_at: null,
      }
    );
  }

  // Liste complète : pour chaque slug du registry, on retourne la row
  // Supabase si elle existe, sinon une coquille.
  const { data, error } = await supabase
    .from("pages")
    .select("slug, status, updated_at");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const bySlug = new Map(
    (data ?? []).map((p) => [p.slug, p as { slug: string; status: string; updated_at: string }])
  );
  const list = Object.values(PAGE_SCHEMAS).map((schema) => ({
    slug: schema.slug,
    title: schema.title,
    description: schema.description,
    url: schema.url,
    status: bySlug.get(schema.slug)?.status ?? "non-edite",
    updated_at: bySlug.get(schema.slug)?.updated_at ?? null,
  }));
  return NextResponse.json(list);
}

// PUT /api/pages
// Body: { slug, content?, seo_title?, seo_description? }
// UPSERT côté Supabase. Si la page n'avait pas de row, on en crée une.
export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.slug !== "string") {
    return NextResponse.json({ error: "Body invalide (slug requis)" }, { status: 400 });
  }
  if (!PAGE_SCHEMAS[body.slug]) {
    return NextResponse.json({ error: "Page inconnue" }, { status: 404 });
  }

  const upsertPayload: Record<string, unknown> = {
    slug: body.slug,
    status: "publie",
    published_at: new Date().toISOString(),
  };
  if (body.content !== undefined) upsertPayload.content = body.content;
  if (body.seo_title !== undefined)
    upsertPayload.seo_title = body.seo_title || null;
  if (body.seo_description !== undefined)
    upsertPayload.seo_description = body.seo_description || null;

  const { error } = await supabase
    .from("pages")
    .upsert(upsertPayload, { onConflict: "slug" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Une sauvegarde de page = publication immédiate (pas de draft pour le pilote).
  // On déclenche le rebuild du site.
  triggerLenoncoteRebuild();

  return NextResponse.json({ success: true });
}
