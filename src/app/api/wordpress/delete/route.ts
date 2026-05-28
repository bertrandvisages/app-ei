import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// No-op : WordPress n'existe plus.
// La suppression Supabase est faite directement côté page (cf. /dashboard/publies).
// Cet endpoint est conservé pour compatibilité avec le code existant qui l'appelle
// en parallèle d'un DELETE Supabase ; il retourne juste success.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  await request.json().catch(() => null);
  return NextResponse.json({ success: true });
}
