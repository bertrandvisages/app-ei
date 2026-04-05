import { NextResponse } from "next/server";
import { pendingImages } from "@/lib/image-notifications";

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

  pendingImages.set(data.post_id, {
    image_url: data.image_url || "",
    image_id: data.image_id || null,
    timestamp: Date.now(),
  });

  return NextResponse.json({ success: true });
}
