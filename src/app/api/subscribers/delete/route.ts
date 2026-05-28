import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Supprime un abonné (admin uniquement).
// Body : { source: "wp" | "inscription", id: string }
// - source "wp"          → DELETE FROM subscribers WHERE id = ...
// - source "inscription" → adminClient.auth.admin.deleteUser(id)
//                          (cascade auth.users → inscrits)
export async function POST(request: Request) {
  try {
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      return NextResponse.json(
        { error: "Configuration serveur incomplète." },
        { status: 500 }
      );
    }

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

    let body: { source?: string; id?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
    }
    const { source, id } = body;
    if (!source || !id) {
      return NextResponse.json(
        { error: "source et id requis" },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    if (source === "wp") {
      const { error } = await adminClient
        .from("subscribers")
        .delete()
        .eq("id", id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    if (source === "inscription") {
      const { error } = await adminClient.auth.admin.deleteUser(id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: `Source inconnue: ${source}` },
      { status: 400 }
    );
  } catch (err) {
    console.error("[subscribers/delete] Unexpected error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur serveur inattendue." },
      { status: 500 }
    );
  }
}
