import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { triggerLenoncoteRebuild } from "@/lib/trigger-deploy";

// Lit le timestamp du dernier déploiement depuis site_meta (singleton id=1).
// Renvoie null si la table n'existe pas encore — le compteur tombe alors
// sur "toutes les publications" et n'est pas bloquant.
async function readLastDeployAt(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string | null> {
  const { data, error } = await supabase
    .from("site_meta")
    .select("last_deploy_at")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) return null;
  return data.last_deploy_at as string;
}

async function countPending(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lastDeployAt: string | null
): Promise<number> {
  // Dossiers / contributions : on compte les "publié" dont la date de
  // publication est postérieure au dernier déploiement.
  const buildPublishedQuery = (table: "dossiers" | "contributions") => {
    let q = supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("status", "publie");
    if (lastDeployAt) q = q.gt("published_at", lastDeployAt);
    return q;
  };

  // Auteurs : on compte ceux modifiés (création ou update) depuis le
  // dernier déploiement. Pas de notion de status pour les auteurs, et
  // le trigger update_authors_updated_at maintient updated_at à jour.
  const buildAuthorsQuery = () => {
    let q = supabase
      .from("authors")
      .select("id", { count: "exact", head: true });
    if (lastDeployAt) q = q.gt("updated_at", lastDeployAt);
    return q;
  };

  const [d, c, a] = await Promise.all([
    buildPublishedQuery("dossiers"),
    buildPublishedQuery("contributions"),
    buildAuthorsQuery(),
  ]);

  return (d.count ?? 0) + (c.count ?? 0) + (a.count ?? 0);
}

// GET : renvoie { last_deploy_at, pending_count }
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const lastDeployAt = await readLastDeployAt(supabase);
    const pending = await countPending(supabase, lastDeployAt);
    return NextResponse.json({
      last_deploy_at: lastDeployAt,
      pending_count: pending,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur" },
      { status: 500 }
    );
  }
}

// POST : déclenche le rebuild Coolify et bump last_deploy_at à now()
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    // Bump le timestamp AVANT le rebuild pour que les publications faites
    // pendant le build ne disparaissent pas du compteur. UPDATE via service_role
    // car les policies de site_meta n'autorisent que SELECT aux authentifiés.
    const admin = createAdminClient();
    const now = new Date().toISOString();
    const { error: upErr } = await admin
      .from("site_meta")
      .update({ last_deploy_at: now })
      .eq("id", 1);
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    // Fire-and-forget : on n'attend pas la fin du build Astro (~1 min)
    triggerLenoncoteRebuild();

    return NextResponse.json({ success: true, last_deploy_at: now });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur" },
      { status: 500 }
    );
  }
}
