#!/usr/bin/env node
/**
 * Convertit en AVIF (qualité 60) les images PNG/JPG/WebP référencées dans
 * authors.image_url, dossiers.cover_image_url et contributions.cover_image_url.
 *
 * Pour chaque ligne :
 *   1. Si l'URL ne pointe pas vers notre bucket Supabase Storage 'media' → skip
 *   2. Si déjà .avif → skip
 *   3. Download le fichier, encode en AVIF via sharp
 *   4. Upload <même_dossier>/<même_basename>.avif
 *   5. UPDATE la colonne avec la nouvelle URL publique
 *   6. Delete l'ancien fichier
 *
 * Idempotent : relancer le script ne touche pas aux .avif déjà migrés.
 *
 * Usage :
 *   node scripts/convert-storage-to-avif.mjs --dry-run        # liste sans modifier
 *   node scripts/convert-storage-to-avif.mjs                  # exécute pour de vrai
 *   node scripts/convert-storage-to-avif.mjs --limit=5        # limite à 5 conversions
 */

import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

// ─── Args ──────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const LIMIT = (() => {
  const a = args.find((x) => x.startsWith("--limit="));
  return a ? parseInt(a.split("=")[1], 10) || Infinity : Infinity;
})();

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

const BUCKET = "media";

// ─── Helpers ───────────────────────────────────────────────

// Parse une URL publique Supabase pour en extraire le path dans le bucket.
// Retourne null si l'URL n'est pas dans notre bucket.
function parseStorageUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
    if (!m) return null;
    const [, bucket, path] = m;
    if (bucket !== BUCKET) return null;
    return decodeURIComponent(path);
  } catch {
    return null;
  }
}

// Extensions qu'on convertit par défaut : PNG seulement (gros gain, et JPG/WebP
// sont déjà compressés, le re-encoding apporte peu).
// `--all` étend à tous les formats raster connus.
const TRANSCODABLE_EXT = args.includes("--all")
  ? new Set(["png", "jpg", "jpeg", "webp", "tiff", "heic", "heif"])
  : new Set(["png"]);

function isTranscodable(path) {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  return TRANSCODABLE_EXT.has(ext);
}

function replaceExtAvif(path) {
  const dot = path.lastIndexOf(".");
  return (dot > 0 ? path.slice(0, dot) : path) + ".avif";
}

async function downloadFile(path) {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) throw new Error(`download ${path}: ${error.message}`);
  return Buffer.from(await data.arrayBuffer());
}

async function uploadAvif(path, buffer) {
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: "image/avif",
    upsert: false,
  });
  if (error) throw new Error(`upload ${path}: ${error.message}`);
}

async function deleteFile(path) {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw new Error(`delete ${path}: ${error.message}`);
}

function publicUrl(path) {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

async function convertToAvif(buffer) {
  return sharp(buffer, { failOn: "none" })
    .rotate()
    .avif({ quality: 60, effort: 4 })
    .toBuffer();
}

// ─── Stats ─────────────────────────────────────────────────
const stats = {
  scanned: 0,
  converted: 0,
  skippedNotStorage: 0,
  skippedAlreadyAvif: 0,
  skippedUnsupported: 0,
  errors: 0,
  bytesBefore: 0,
  bytesAfter: 0,
};

let processed = 0;

// ─── Cœur du traitement ────────────────────────────────────
async function processRow({ table, idColumn, urlColumn, id, url }) {
  if (processed >= LIMIT) return;
  stats.scanned++;

  const oldPath = parseStorageUrl(url);
  if (!oldPath) {
    stats.skippedNotStorage++;
    return;
  }
  if (oldPath.toLowerCase().endsWith(".avif")) {
    stats.skippedAlreadyAvif++;
    return;
  }
  if (!isTranscodable(oldPath)) {
    stats.skippedUnsupported++;
    console.log(`  ⏭️  ${table}#${id} format non transcodable : ${oldPath}`);
    return;
  }

  const newPath = replaceExtAvif(oldPath);
  console.log(`→ ${table}#${id}`);
  console.log(`   ${oldPath}`);
  console.log(`   → ${newPath}`);

  if (DRY_RUN) {
    stats.converted++;
    processed++;
    return;
  }

  try {
    const original = await downloadFile(oldPath);
    const avifBuf = await convertToAvif(original);

    stats.bytesBefore += original.length;
    stats.bytesAfter += avifBuf.length;

    await uploadAvif(newPath, avifBuf);

    const newUrl = publicUrl(newPath);
    const { error: updateErr } = await supabase
      .from(table)
      .update({ [urlColumn]: newUrl })
      .eq(idColumn, id);
    if (updateErr) {
      // Rollback : on supprime le .avif qu'on vient d'uploader pour éviter
      // de laisser un fichier orphelin sans ligne qui le référence.
      await deleteFile(newPath).catch(() => {});
      throw new Error(`UPDATE ${table}: ${updateErr.message}`);
    }

    await deleteFile(oldPath);

    const ratio = (avifBuf.length / original.length) * 100;
    console.log(
      `   ✅ ${original.length} → ${avifBuf.length} octets (${ratio.toFixed(1)}%)`
    );
    stats.converted++;
    processed++;
  } catch (err) {
    stats.errors++;
    console.error(`   ❌ ${err instanceof Error ? err.message : err}`);
  }
}

// ─── Boucle sur les 3 tables ───────────────────────────────
const TABLES = [
  { table: "authors", idColumn: "id", urlColumn: "image_url" },
  { table: "dossiers", idColumn: "id", urlColumn: "cover_image_url" },
  { table: "contributions", idColumn: "id", urlColumn: "cover_image_url" },
];

console.log(
  `\n${DRY_RUN ? "🔍 DRY-RUN" : "🚀 EXÉCUTION"}${
    LIMIT !== Infinity ? ` (limite : ${LIMIT})` : ""
  }\n`
);

for (const cfg of TABLES) {
  console.log(`\n━━━ ${cfg.table}.${cfg.urlColumn} ━━━`);
  const { data, error } = await supabase
    .from(cfg.table)
    .select(`${cfg.idColumn}, ${cfg.urlColumn}`)
    .not(cfg.urlColumn, "is", null);
  if (error) {
    console.error(`❌ SELECT ${cfg.table}: ${error.message}`);
    continue;
  }
  for (const row of data || []) {
    if (processed >= LIMIT) break;
    await processRow({
      ...cfg,
      id: row[cfg.idColumn],
      url: row[cfg.urlColumn],
    });
  }
}

// ─── Récap ─────────────────────────────────────────────────
console.log("\n━━━ RÉCAP ━━━");
console.log(`Lignes scannées        : ${stats.scanned}`);
console.log(`Converties             : ${stats.converted}`);
console.log(`Skip (hors bucket)     : ${stats.skippedNotStorage}`);
console.log(`Skip (déjà AVIF)       : ${stats.skippedAlreadyAvif}`);
console.log(`Skip (format inconnu)  : ${stats.skippedUnsupported}`);
console.log(`Erreurs                : ${stats.errors}`);
if (stats.bytesBefore > 0) {
  const savedKb = (stats.bytesBefore - stats.bytesAfter) / 1024;
  const ratio = (stats.bytesAfter / stats.bytesBefore) * 100;
  console.log(
    `Octets : ${stats.bytesBefore.toLocaleString()} → ${stats.bytesAfter.toLocaleString()} (${ratio.toFixed(
      1
    )}%, gain ${savedKb.toFixed(0)} KB)`
  );
}
if (DRY_RUN) {
  console.log("\n💡 C'était un dry-run. Relance sans --dry-run pour appliquer.");
}
