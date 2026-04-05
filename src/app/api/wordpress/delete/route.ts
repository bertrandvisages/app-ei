import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { postId } = await request.json();
  if (!postId) {
    return NextResponse.json({ error: "postId requis" }, { status: 400 });
  }

  const wpUrl = process.env.WORDPRESS_API_URL;
  const wpUser = process.env.WORDPRESS_USERNAME;
  const wpPass = process.env.WORDPRESS_APP_PASSWORD;
  const credentials = Buffer.from(`${wpUser}:${wpPass}`).toString("base64");

  try {
    const res = await fetch(`${wpUrl}/posts/${postId}?force=true`, {
      method: "DELETE",
      headers: {
        Authorization: `Basic ${credentials}`,
      },
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur" },
      { status: 502 }
    );
  }
}
