import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Called by n8n when image generation is complete
export async function POST(request: Request) {
  let data;
  try {
    data = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  if (!data.post_id) {
    return NextResponse.json({ error: "post_id requis" }, { status: 400 });
  }

  // Store notification in Supabase
  const supabase = createAdminClient();
  await supabase.from("notifications").insert({
    type: "image_ready",
    post_id: data.post_id,
    image_url: data.image_url || "",
    image_id: data.image_id || null,
  });

  return NextResponse.json({ success: true });
}
