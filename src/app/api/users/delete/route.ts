import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

    // Auth + admin check
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

    let body: { userId?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
    }
    const { userId } = body;
    if (!userId) {
      return NextResponse.json({ error: "userId requis" }, { status: 400 });
    }

    // Sécurité : on refuse l'auto-suppression
    if (userId === user.id) {
      return NextResponse.json(
        { error: "Vous ne pouvez pas vous supprimer vous-même." },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();
    const { error: delError } = await adminClient.auth.admin.deleteUser(userId);
    if (delError) {
      console.error("[users/delete] deleteUser error:", delError);
      return NextResponse.json(
        { error: delError.message || "Erreur suppression utilisateur" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[users/delete] Unexpected error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur serveur inattendue." },
      { status: 500 }
    );
  }
}
