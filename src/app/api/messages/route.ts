import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Routes admin pour la rubrique Messages du dashboard.
//
// GET  /api/messages                  → liste triee par created_at desc
// GET  /api/messages?id=...           → un message + bascule status a 'lu'
// GET  /api/messages?count=unread     → renvoie { unread: N } pour le badge
// PUT  /api/messages                  → { id, status } toggle lu/non_lu
// DELETE /api/messages?id=...         → suppression definitive

type MessageRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  message: string;
  status: string;
  created_at: string;
  updated_at: string;
};

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { supabase: null, error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  }
  return { supabase, error: null };
}

export async function GET(request: Request) {
  const { supabase, error: authErr } = await requireAuth();
  if (authErr) return authErr;
  if (!supabase) return NextResponse.json({ error: "Erreur interne" }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const count = searchParams.get("count");

  // Compteur de non-lus pour le badge sidebar
  if (count === "unread") {
    const { count: n, error } = await supabase
      .from("contact_messages")
      .select("*", { count: "exact", head: true })
      .eq("status", "non_lu");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ unread: n ?? 0 });
  }

  // Detail d'un message + passe en 'lu' au passage
  if (id) {
    const { data, error } = await supabase
      .from("contact_messages")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Message introuvable" }, { status: 404 });

    if ((data as MessageRow).status === "non_lu") {
      await supabase
        .from("contact_messages")
        .update({ status: "lu" })
        .eq("id", id);
      (data as MessageRow).status = "lu";
    }
    return NextResponse.json(data);
  }

  // Liste complete
  const { data, error } = await supabase
    .from("contact_messages")
    .select("id, first_name, last_name, email, message, status, created_at, updated_at")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  const { supabase, error: authErr } = await requireAuth();
  if (authErr) return authErr;
  if (!supabase) return NextResponse.json({ error: "Erreur interne" }, { status: 500 });

  const body = await request.json().catch(() => null);
  if (!body?.id || (body.status !== "lu" && body.status !== "non_lu")) {
    return NextResponse.json(
      { error: "Body invalide (id + status lu|non_lu requis)" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("contact_messages")
    .update({ status: body.status })
    .eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const { supabase, error: authErr } = await requireAuth();
  if (authErr) return authErr;
  if (!supabase) return NextResponse.json({ error: "Erreur interne" }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  const { error } = await supabase
    .from("contact_messages")
    .delete()
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
