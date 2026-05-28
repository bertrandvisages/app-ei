import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Slugifie un texte (sans accents, lowercase, tirets)
function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type AuthorRow = {
  id: string;
  wp_id: number | null;
  slug: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  bio: string | null;
  job_title: string | null;
  company: string | null;
  company_website: string | null;
  linkedin: string | null;
  image_url: string | null;
};

// Map Supabase row → shape attendue par le dashboard (rétrocompatible WP API)
function toApiShape(a: AuthorRow) {
  return {
    id: a.id,
    name: a.name,
    first_name: a.first_name ?? "",
    last_name: a.last_name ?? "",
    slug: a.slug,
    email: "",
    description: a.bio ?? "",
    avatar_url: a.image_url ?? "",
    image_id: null,
    link: "",
    job_title: a.job_title ?? "",
    company: a.company ?? "",
    company_website: a.company_website ?? "",
    linkedin: a.linkedin ?? "",
  };
}

// GET : liste des auteurs
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("authors")
    .select(
      "id, wp_id, slug, name, first_name, last_name, bio, job_title, company, company_website, linkedin, image_url"
    )
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json((data as AuthorRow[]).map(toApiShape));
}

// POST : création d'un auteur (admin uniquement)
export async function POST(request: Request) {
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

  const body = await request.json();

  const firstName = String(body.first_name ?? "").trim();
  const lastName = String(body.last_name ?? "").trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  if (!fullName) {
    return NextResponse.json({ error: "Prénom ou nom requis" }, { status: 400 });
  }

  const slug = slugify(fullName);

  const insertPayload = {
    slug,
    name: fullName,
    first_name: firstName || null,
    last_name: lastName || null,
    bio: body.description || null,
    job_title: body.job_title || null,
    company: body.company || null,
    company_website: body.company_website || null,
    linkedin: body.linkedin || null,
    image_url: body.image_url || null,
  };

  const { data, error } = await supabase
    .from("authors")
    .insert(insertPayload)
    .select(
      "id, wp_id, slug, name, first_name, last_name, bio, job_title, company, company_website, linkedin, image_url"
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(toApiShape(data as AuthorRow));
}

// PUT : mise à jour d'un auteur (PATCH partiel : seuls les champs envoyés sont mis à jour)
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

  // Construire le payload uniquement avec les champs explicitement présents
  const updatePayload: Record<string, unknown> = {};
  if (body.first_name !== undefined) updatePayload.first_name = body.first_name || null;
  if (body.last_name !== undefined) updatePayload.last_name = body.last_name || null;
  if (body.description !== undefined) updatePayload.bio = body.description || null;
  if (body.job_title !== undefined) updatePayload.job_title = body.job_title || null;
  if (body.company !== undefined) updatePayload.company = body.company || null;
  if (body.company_website !== undefined) updatePayload.company_website = body.company_website || null;
  if (body.linkedin !== undefined) updatePayload.linkedin = body.linkedin || null;
  if (body.image_url !== undefined) updatePayload.image_url = body.image_url || null;

  // Recompute 'name' uniquement si first_name OU last_name a été fourni
  if (body.first_name !== undefined || body.last_name !== undefined) {
    const firstName = String(body.first_name ?? "").trim();
    const lastName = String(body.last_name ?? "").trim();
    const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
    if (fullName) updatePayload.name = fullName;
  }

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: "Aucun champ à mettre à jour" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("authors")
    .update(updatePayload)
    .eq("id", body.id)
    .select(
      "id, wp_id, slug, name, first_name, last_name, bio, job_title, company, company_website, linkedin, image_url"
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(toApiShape(data as AuthorRow));
}

// DELETE : suppression (admin uniquement)
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

  const { error } = await supabase.from("authors").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
