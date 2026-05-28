import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    // Vérifie env vars critiques avant toute opération
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      console.error(
        "[users/create] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant"
      );
      return NextResponse.json(
        { error: "Configuration serveur incomplète." },
        { status: 500 }
      );
    }

    // Auth check : appelant authentifié ?
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Auth check : appelant admin ?
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Body parsing
    let body: { email?: string; password?: string; fullName?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Body JSON invalide" },
        { status: 400 }
      );
    }
    const { email, password, fullName } = body;
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email et mot de passe requis" },
        { status: 400 }
      );
    }

    // Création via service_role. Le trigger handle_new_user
    // crée automatiquement le profile editeur.
    const adminClient = createAdminClient();
    const { data: newUser, error: createError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName || email },
      });

    if (createError) {
      console.error("[users/create] createUser error:", createError);
      return NextResponse.json(
        { error: createError.message || "Erreur création utilisateur" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, userId: newUser.user?.id });
  } catch (err) {
    // Filet de sécurité : on log et on renvoie TOUJOURS un JSON
    console.error("[users/create] Unexpected error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Erreur serveur inattendue.",
      },
      { status: 500 }
    );
  }
}
