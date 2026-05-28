import type { SupabaseClient } from "@supabase/supabase-js";

const PUBLIC_URL_RE = /\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/;

// Notre seul bucket. Empêche un effacement accidentel via une URL forgée qui
// pointerait vers un autre bucket.
const OWNED_BUCKETS = new Set(["media"]);

function parsePublicUrl(url: string): { bucket: string; path: string } | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const match = u.pathname.match(PUBLIC_URL_RE);
    if (!match) return null;
    const [, bucket, path] = match;
    if (!OWNED_BUCKETS.has(bucket)) return null;
    return { bucket, path: decodeURIComponent(path) };
  } catch {
    return null;
  }
}

// Supprime un fichier du Storage en best-effort à partir de son URL publique.
// Silencieux sur échec : on ne veut pas bloquer un save parce que le cleanup
// du fichier orphelin a raté (le fichier restera, c'est tout).
export async function deleteStorageObjectByPublicUrl(
  supabase: SupabaseClient,
  publicUrl: string | null | undefined
): Promise<void> {
  if (!publicUrl) return;
  const parsed = parsePublicUrl(publicUrl);
  if (!parsed) return;
  const { error } = await supabase.storage.from(parsed.bucket).remove([parsed.path]);
  if (error) {
    console.warn(
      `[storage] suppression de ${parsed.bucket}/${parsed.path} échouée :`,
      error.message
    );
  }
}
