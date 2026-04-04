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

// GET: list authors
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const res = await wpFetch("/users?roles=author&per_page=100&context=edit");
    if (!res.ok) {
      return NextResponse.json({ error: "Erreur WordPress" }, { status: 502 });
    }
    const users = await res.json();

    const authors = users.map((u: Record<string, unknown>) => ({
      id: u.id,
      name: u.name,
      first_name: u.first_name || "",
      last_name: u.last_name || "",
      slug: u.slug,
      email: u.email || "",
      description: u.description || "",
      avatar_url: (u.avatar_urls as Record<string, string>)?.["96"] || "",
      link: u.link || "",
      job_title: u.molongui_author_job || "",
      company: u.molongui_author_company || "",
      linkedin: u.molongui_author_linkedin || "",
    }));

    return NextResponse.json(authors);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur" },
      { status: 502 }
    );
  }
}

// POST: create author
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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

  // Generate a random password since authors won't login
  const password = Math.random().toString(36).slice(-12) + "Aa1!";

  try {
    const res = await wpFetch("/users", {
      method: "POST",
      body: JSON.stringify({
        username: body.username || `${body.first_name}-${body.last_name}`.toLowerCase().replace(/\s+/g, "-"),
        email: body.email || `${body.first_name}.${body.last_name}@lenoncote.fr`.toLowerCase().replace(/\s+/g, ""),
        password,
        first_name: body.first_name || "",
        last_name: body.last_name || "",
        description: body.description || "",
        roles: ["author"],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: 502 });
    }

    const newUser = await res.json();

    // Update Molongui meta fields
    if (body.job_title || body.company || body.linkedin) {
      await wpFetch(`/users/${newUser.id}`, {
        method: "POST",
        body: JSON.stringify({
          meta: {
            molongui_author_job: body.job_title || "",
            molongui_author_company: body.company || "",
            molongui_author_linkedin: body.linkedin || "",
          },
        }),
      });
    }

    return NextResponse.json({
      id: newUser.id,
      name: newUser.name,
      slug: newUser.slug,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur" },
      { status: 502 }
    );
  }
}

// PUT: update author
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
    const updateData: Record<string, unknown> = {
      first_name: body.first_name,
      last_name: body.last_name,
      description: body.description,
    };

    if (body.email) {
      updateData.email = body.email;
    }

    // Molongui meta
    updateData.meta = {
      molongui_author_job: body.job_title || "",
      molongui_author_company: body.company || "",
      molongui_author_linkedin: body.linkedin || "",
    };

    const res = await wpFetch(`/users/${body.id}`, {
      method: "POST",
      body: JSON.stringify(updateData),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: 502 });
    }

    const updated = await res.json();
    return NextResponse.json({ success: true, name: updated.name });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur" },
      { status: 502 }
    );
  }
}
