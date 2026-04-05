import { NextResponse } from "next/server";
import { pendingImages } from "@/lib/image-notifications";

// GET: check for pending image notifications
export async function GET() {
  const results = [];

  for (const [postId, data] of pendingImages.entries()) {
    results.push({
      post_id: postId,
      image_url: data.image_url,
      image_id: data.image_id,
    });
  }

  // Clear returned notifications
  for (const r of results) {
    pendingImages.delete(r.post_id);
  }

  // Clean old entries (> 10 min)
  const now = Date.now();
  for (const [postId, data] of pendingImages.entries()) {
    if (now - data.timestamp > 600000) {
      pendingImages.delete(postId);
    }
  }

  return NextResponse.json(results);
}
