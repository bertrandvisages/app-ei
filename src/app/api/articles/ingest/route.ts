import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  // Verify API key (use service_role key as auth)
  const authHeader = request.headers.get("authorization");
  const expectedKey = `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`;

  if (authHeader !== expectedKey) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await request.json();
  const articles = Array.isArray(body) ? body : [body];

  const supabase = createAdminClient();

  const rows = articles.map((a) => ({
    title: a.title,
    content: a.content || null,
    source_url: a.source_url || null,
    source_name: a.source_name || null,
    categories: a.categories || [],
    tags: a.tags || [],
    date_source: a.date ? new Date(a.date).toISOString() : null,
    status: "draft",
  }));

  const { data, error } = await supabase.from("articles").insert(rows).select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ inserted: data?.length || 0 });
}
