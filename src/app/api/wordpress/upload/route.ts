import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// TODO Phase 4 : remplacer par un upload vers Supabase Storage (bucket MinIO).
// Pour l'instant : 501 Not Implemented (UI uploads → toast erreur clair).
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  return NextResponse.json(
    {
      error:
        "Upload média non disponible (migration WordPress → Supabase Storage en cours).",
    },
    { status: 501 }
  );
}
