import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Met a jour un editeur existant : email, full_name et/ou mot de passe.
// Reserve aux admins.
//
// Body : { userId, email?, fullName?, password? }
// - Seuls les champs presents non-vides sont mis a jour
// - password est mis a jour cote auth.users via admin.updateUserById
// - full_name est mis a jour dans la table profiles (visible dans la liste)

export async function POST(request: Request) {
  try {
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      console.error(
        "[users/update] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant"
      );
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

    let body: {
      userId?: string;
      email?: string;
      fullName?: string;
      password?: string;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Body JSON invalide" },
        { status: 400 }
      );
    }

    const { userId, email, fullName, password } = body;
    if (!userId) {
      return NextResponse.json({ error: "userId requis" }, { status: 400 });
    }

    // Validation legere des champs fournis
    if (email !== undefined && email !== "") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json(
          { error: "Email invalide" },
          { status: 400 }
        );
      }
    }
    if (password !== undefined && password !== "" && password.length < 6) {
      return NextResponse.json(
        { error: "Le mot de passe doit faire au moins 6 caractères" },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Mise a jour auth.users (email / password / metadata) si quelque chose
    // de auth-related a change. On compose un patch minimal.
    const authPatch: {
      email?: string;
      password?: string;
      user_metadata?: Record<string, unknown>;
    } = {};
    if (email !== undefined && email !== "") authPatch.email = email;
    if (password !== undefined && password !== "") authPatch.password = password;
    if (fullName !== undefined) {
      authPatch.user_metadata = { full_name: fullName || "" };
    }

    if (Object.keys(authPatch).length > 0) {
      const { error: authErr } = await adminClient.auth.admin.updateUserById(
        userId,
        authPatch
      );
      if (authErr) {
        console.error("[users/update] updateUserById error:", authErr);
        return NextResponse.json(
          { error: authErr.message || "Erreur de mise à jour" },
          { status: 400 }
        );
      }
    }

    // Mise a jour de la table profiles pour que la liste reflete les
    // changements (la table n'est pas re-syncronisee automatiquement avec
    // auth.users sur les UPDATE — uniquement sur INSERT via le trigger
    // handle_new_user).
    const profilePatch: Record<string, unknown> = {};
    if (fullName !== undefined) profilePatch.full_name = fullName || null;
    if (email !== undefined && email !== "") profilePatch.email = email;

    if (Object.keys(profilePatch).length > 0) {
      const { error: profErr } = await adminClient
        .from("profiles")
        .update(profilePatch)
        .eq("id", userId);
      if (profErr) {
        console.warn("[users/update] profiles update warning:", profErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[users/update] Unexpected error:", err);
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
