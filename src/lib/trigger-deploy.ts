// Déclenche un rebuild Coolify du site public Astro (lenoncote.fr / preview).
// Appelé après chaque publication de contenu (article, dossier, contribution)
// pour que le site statique se régénère avec les dernières données Supabase.
//
// Variables d'env requises côté DASH-EI (Runtime uniquement) :
//   - COOLIFY_DEPLOY_WEBHOOK_URL
//   - COOLIFY_API_TOKEN

export async function triggerLenoncoteRebuild(): Promise<void> {
  const url = process.env.COOLIFY_DEPLOY_WEBHOOK_URL;
  const token = process.env.COOLIFY_API_TOKEN;

  if (!url || !token) {
    console.warn(
      "[trigger-deploy] COOLIFY_DEPLOY_WEBHOOK_URL ou COOLIFY_API_TOKEN manquant — rebuild non déclenché."
    );
    return;
  }

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        `[trigger-deploy] Coolify webhook failed: ${res.status} ${body}`
      );
      return;
    }

    console.info("[trigger-deploy] Coolify rebuild déclenché.");
  } catch (err) {
    console.error("[trigger-deploy] Erreur réseau:", err);
  }
}
