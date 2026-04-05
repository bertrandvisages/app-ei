import { NextResponse } from "next/server";
import { addNotification } from "@/lib/image-notifications";

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

  addNotification(data.post_id, data.image_url || "", data.image_id || null);

  return NextResponse.json({ success: true });
}
