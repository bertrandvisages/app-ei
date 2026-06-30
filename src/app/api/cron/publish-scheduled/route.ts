import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { triggerLenoncoteRebuild } from "@/lib/trigger-deploy";

// Cron : publie les dossiers / contributions programmés dont l'heure est passée.
//
// Appelé périodiquement (ex. toutes les 5 min) par une Scheduled Task Coolify :
//   curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
//     https://dash.lenoncote.fr/api/cron/publish-scheduled
//
// Pour chaque table, on flippe `programme` → `publie` quand
// `scheduled_publish_at <= now()`, on bump `published_at`, on efface la date
// programmée, puis on déclenche UN SEUL rebuild Coolify si au moins un item a
// été publié.
//
// Env vars requises (Runtime) :
//   - SUPABASE_SERVICE_ROLE_KEY (+ NEXT_PUBLIC_SUPABASE_URL)
//   - CRON_SECRET
//   - COOLIFY_DEPLOY_WEBHOOK_URL + COOLIFY_API_TOKEN (pour le rebuild)

export const dynamic = "force-dynamic";

type PublishResult = { published: number; ids: string[] };

async function publishDue(
  supabase: ReturnType<typeof createAdminClient>,
  table: "dossiers" | "contributions",
  nowIso: string
): Promise<PublishResult> {
  // 1. On récupère les ids dûs (status=programme ET date passée)
  const { data: due, error: selectError } = await supabase
    .from(table)
    .select("id")
    .eq("status", "programme")
    .not("scheduled_publish_at", "is", null)
    .lte("scheduled_publish_at", nowIso);

  if (selectError) {
    throw new Error(`${table} select: ${selectError.message}`);
  }

  const ids = (due ?? []).map((r: { id: string }) => r.id);
  if (ids.length === 0) {
    return { published: 0, ids: [] };
  }

  // 2. On les passe en publie. published_at = l'heure programmée prévue
  //    serait plus fidèle, mais on garde now() pour rester cohérent avec la
  //    publication manuelle (route PUT) et garantir published_at > updated_at.
  const { error: updateError } = await supabase
    .from(table)
    .update({
      status: "publie",
      published_at: nowIso,
      scheduled_publish_at: null,
    })
    .in("id", ids);

  if (updateError) {
    throw new Error(`${table} update: ${updateError.message}`);
  }

  return { published: ids.length, ids };
}

export async function GET(request: Request) {
  try {
    // Auth : secret partagé dans le header Authorization.
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      console.error("[cron/publish-scheduled] CRON_SECRET manquant");
      return NextResponse.json(
        { error: "Configuration serveur incomplète." },
        { status: 500 }
      );
    }
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      console.error(
        "[cron/publish-scheduled] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant"
      );
      return NextResponse.json(
        { error: "Configuration serveur incomplète." },
        { status: 500 }
      );
    }

    const supabase = createAdminClient();
    const nowIso = new Date().toISOString();

    const dossiers = await publishDue(supabase, "dossiers", nowIso);
    const contributions = await publishDue(supabase, "contributions", nowIso);

    const total = dossiers.published + contributions.published;

    // Un seul rebuild si quelque chose a été publié.
    if (total > 0) {
      console.info(
        `[cron/publish-scheduled] ${dossiers.published} dossier(s) + ${contributions.published} contribution(s) publié(s) → rebuild`
      );
      await triggerLenoncoteRebuild();
    }

    return NextResponse.json({
      ok: true,
      published: total,
      dossiers,
      contributions,
    });
  } catch (err) {
    console.error("[cron/publish-scheduled] Erreur:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur inconnue" },
      { status: 500 }
    );
  }
}
