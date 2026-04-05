import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET: check for unread notifications
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("read", false)
    .eq("type", "image_ready")
    .order("created_at", { ascending: false });

  // Mark as read
  if (data && data.length > 0) {
    await supabase
      .from("notifications")
      .update({ read: true })
      .in("id", data.map((n) => n.id));
  }

  return NextResponse.json(data || []);
}
