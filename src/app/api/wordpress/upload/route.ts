import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const wpUrl = process.env.WORDPRESS_API_URL;
  const wpUser = process.env.WORDPRESS_USERNAME;
  const wpPass = process.env.WORDPRESS_APP_PASSWORD;
  const credentials = Buffer.from(`${wpUser}:${wpPass}`).toString("base64");

  const formData = await request.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return NextResponse.json({ error: "Fichier requis" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const res = await fetch(`${wpUrl}/media`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Disposition": `attachment; filename="${file.name}"`,
        "Content-Type": file.type,
      },
      body: buffer,
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: 502 });
    }

    const media = await res.json();
    return NextResponse.json({
      id: media.id,
      url: media.source_url,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur upload" },
      { status: 502 }
    );
  }
}
