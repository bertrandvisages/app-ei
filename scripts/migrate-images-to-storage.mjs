#!/usr/bin/env node
/**
 * Migre les images statiques /images/wp/... du repo Astro vers Supabase Storage.
 *
 * Pour chaque ligne authors.image_url / dossiers.cover_image_url /
 * contributions.cover_image_url qui pointe vers /images/wp/..., on :
 *   1. Lit le fichier dans /Users/bertrandlevet/Projects/lenoncote/public<path>
 *   2. Upload dans le bucket 'media' à <table>/<chemin-relatif>
 *   3. Met à jour la colonne avec l'URL publique Storage
 *
 * Idempotent : skip si l'image_url ne commence pas par /images/wp/.
 *
 * Usage : node scripts/migrate-images-to-storage.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

// ─── Env ───────────────────────────────────────────────────
const ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const envFile = readFileSync(join(ROOT, ".env.local"), "utf8");
const env = Object.fromEntries(
  envFile
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ Manque SUPABASE_URL ou SERVICE_ROLE_KEY dans .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const STATIC_ROOT = "/Users/bertrandlevet/Projects/lenoncote/public";
const BUCKET = "media";

// ─── Mapping content-type par extension ───────────────────
const MIME = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
};

async function migrateOne(table, imageField, row) {
  // Accepte deux formats :
  //   /images/wp/...
  //   https://preview.lenoncote.fr/images/wp/...
  // → extrait le chemin local après /images/wp/
  const rawUrl = row[imageField];
  const localRelative = rawUrl.replace(
    /^https?:\/\/[^/]+(\/images\/wp\/)/,
    "$1"
  );

  const localPath = join(STATIC_ROOT, localRelative);
  if (!existsSync(localPath)) {
    console.warn(`  ⚠️  ${table} ${row.slug} — fichier introuvable: ${localPath}`);
    return false;
  }

  const ext = extname(localRelative).toLowerCase();
  const contentType = MIME[ext] || "application/octet-stream";

  // Storage path : <table>/<chemin-après-/images/wp/>
  // ex. /images/wp/2025/11/Bertrand.jpg → authors/2025/11/Bertrand.jpg
  const relativeAfterWp = localRelative.replace(/^\/images\/wp\//, "");
  const storagePath = `${table}/${relativeAfterWp}`;

  const buffer = readFileSync(localPath);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType,
      upsert: true, // idempotent : overwrite si re-run
    });

  if (uploadError) {
    console.error(`  ❌ ${table} ${row.slug} — upload failed: ${uploadError.message}`);
    return false;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

  const { error: updateError } = await supabase
    .from(table)
    .update({ [imageField]: publicUrl })
    .eq("id", row.id);

  if (updateError) {
    console.error(`  ❌ ${table} ${row.slug} — DB update failed: ${updateError.message}`);
    return false;
  }

  console.log(`  ✅ ${table} ${row.slug}`);
  return true;
}

async function migrateTable(table, imageField) {
  console.log(`\n📁 ${table}.${imageField}`);
  // Matche les chemins relatifs /images/wp/... ET les URLs absolues preview/prod
  const { data, error } = await supabase
    .from(table)
    .select(`id, slug, ${imageField}`)
    .or(
      `${imageField}.like./images/wp/%,${imageField}.like.https://preview.lenoncote.fr/images/wp/%,${imageField}.like.https://lenoncote.fr/images/wp/%`
    );

  if (error) {
    console.error(`  ❌ Erreur SELECT: ${error.message}`);
    return;
  }

  if (!data.length) {
    console.log(`  (rien à migrer)`);
    return;
  }

  console.log(`  ${data.length} ligne(s) à migrer`);
  for (const row of data) {
    await migrateOne(table, imageField, row);
  }
}

// ─── Run ──────────────────────────────────────────────────
(async () => {
  console.log(`🔌 ${SUPABASE_URL}`);
  await migrateTable("authors", "image_url");
  await migrateTable("dossiers", "cover_image_url");
  await migrateTable("contributions", "cover_image_url");
  console.log("\n🎉 Migration images terminée");
})();
