#!/usr/bin/env node
/**
 * Migration one-shot : importe les contenus statiques du site Astro
 * (/Users/bertrandlevet/Projects/lenoncote/src/content/) vers Supabase.
 *
 * Usage :
 *   1. npm install --save-dev gray-matter
 *   2. node scripts/migrate-from-static.mjs
 *
 * Idempotent : upsert par wp_id.
 *
 * Prérequis :
 *   - Le SQL supabase-phase1-authors-dossiers.sql doit avoir été exécuté
 *   - .env.local doit contenir NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { createClient } from "@supabase/supabase-js";

// ─── Charger .env.local manuellement (pas de dotenv ici) ───
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
  console.error("❌ Manque NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY dans .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ─── Source : repo Astro lenoncote ─────────────────────────
const ASTRO_CONTENT = "/Users/bertrandlevet/Projects/lenoncote/src/content";
const AUTHORS_DIR = join(ASTRO_CONTENT, "authors");
const POSTS_DIR = join(ASTRO_CONTENT, "posts");

function readMarkdown(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const raw = readFileSync(join(dir, f), "utf8");
      const { data, content } = matter(raw);
      return { file: f, frontmatter: data, body: content.trim() };
    });
}

// ─── 1. AUTEURS ───────────────────────────────────────────
async function importAuthors() {
  const authors = readMarkdown(AUTHORS_DIR);
  console.log(`\n📚 ${authors.length} auteur(s) à importer`);

  const rows = authors.map(({ frontmatter: f }) => ({
    wp_id: typeof f.id === "number" ? f.id : null,
    slug: f.slug,
    name: f.name,
    first_name: f.first_name || null,
    last_name: f.last_name || null,
    bio: f.description || null,
    job_title: f.job_title || null,
    company: f.company || null,
    company_website: f.company_website || null,
    linkedin: f.linkedin || null,
    image_url: f.image || null,
  }));

  const { data, error } = await supabase
    .from("authors")
    .upsert(rows, { onConflict: "slug" })
    .select("id, slug");

  if (error) {
    console.error("❌ Erreur import auteurs:", error.message);
    process.exit(1);
  }

  // Map slug → id pour les FK des dossiers/contributions
  const slugToId = new Map(data.map((a) => [a.slug, a.id]));
  console.log(`✅ ${data.length} auteurs upsertés`);
  return slugToId;
}

// ─── 2. POSTS (articles / dossiers / contributions) ──────
async function importPosts(authorSlugToId) {
  const posts = readMarkdown(POSTS_DIR);
  console.log(`\n📰 ${posts.length} post(s) à analyser`);

  const buckets = { articles: [], dossiers: [], contributions: [] };

  for (const { frontmatter: f, body } of posts) {
    const categories = Array.isArray(f.categories) ? f.categories.map((c) => String(c).toLowerCase()) : [];
    const isContribution = categories.includes("contribution");
    const isDossier = categories.includes("dossiers") || categories.includes("dossier");

    const authorId = authorSlugToId.get(f.author) || null;
    const publishedAt = f.date ? new Date(f.date).toISOString() : null;

    if (isContribution) {
      buckets.contributions.push({
        wp_id: typeof f.id === "number" ? f.id : null,
        slug: f.slug,
        title: f.title,
        content: body,
        excerpt: f.excerpt || null,
        cover_image_url: f.featured_image || null,
        author_id: authorId,
        status: "publie",
        published_at: publishedAt,
        _author_slug: f.author, // tag pour log seulement
      });
    } else if (isDossier) {
      buckets.dossiers.push({
        wp_id: typeof f.id === "number" ? f.id : null,
        slug: f.slug,
        title: f.title,
        description: body,
        excerpt: f.excerpt || null,
        cover_image_url: f.featured_image || null,
        author_id: authorId,
        status: "publie",
        published_at: publishedAt,
      });
    } else {
      // Articles / Actualités
      buckets.articles.push({
        title: f.title,
        content: body,
        source_url: f.original_url || null,
        source_name: f.author_name || null,
        categories: Array.isArray(f.categories) ? f.categories : [],
        tags: Array.isArray(f.tags) ? f.tags : [],
        date_source: publishedAt,
        wordpress_post_id: typeof f.id === "number" ? f.id : null,
        wordpress_url: f.original_url || null,
        author_id: authorId,
        status: "publie",
      });
    }
  }

  console.log(
    `  → ${buckets.articles.length} articles, ${buckets.dossiers.length} dossiers, ${buckets.contributions.length} contributions`
  );

  // ─── Upsert articles ───
  if (buckets.articles.length) {
    const { error } = await supabase
      .from("articles")
      .upsert(buckets.articles, { onConflict: "wordpress_post_id", ignoreDuplicates: false });
    if (error) {
      console.error("❌ Erreur import articles:", error.message);
      process.exit(1);
    }
    console.log(`✅ ${buckets.articles.length} articles upsertés`);
  }

  // ─── Upsert dossiers ───
  let dossierSlugToId = new Map();
  if (buckets.dossiers.length) {
    const { data, error } = await supabase
      .from("dossiers")
      .upsert(buckets.dossiers, { onConflict: "slug" })
      .select("id, slug");
    if (error) {
      console.error("❌ Erreur import dossiers:", error.message);
      process.exit(1);
    }
    dossierSlugToId = new Map(data.map((d) => [d.slug, d.id]));
    console.log(`✅ ${data.length} dossiers upsertés`);
  }

  // ─── Upsert contributions ───
  // ⚠️ Contributions ont besoin d'un dossier_id. Pour le MVP on les rattache
  // au PREMIER dossier importé (à affiner manuellement après).
  if (buckets.contributions.length) {
    const defaultDossierId = dossierSlugToId.values().next().value;
    if (!defaultDossierId) {
      console.warn(
        `⚠️  ${buckets.contributions.length} contributions à importer mais aucun dossier disponible.`
      );
      console.warn(`   Skip. Crée au moins 1 dossier puis re-lance.`);
    } else {
      const rows = buckets.contributions.map((c) => {
        const { _author_slug, ...rest } = c;
        return { ...rest, dossier_id: defaultDossierId };
      });
      const { error } = await supabase
        .from("contributions")
        .upsert(rows, { onConflict: "slug" });
      if (error) {
        console.error("❌ Erreur import contributions:", error.message);
        process.exit(1);
      }
      console.log(
        `✅ ${rows.length} contributions upsertées (rattachées par défaut au dossier "${[...dossierSlugToId.keys()][0]}" — à ajuster dans le dashboard)`
      );
    }
  }
}

// ─── Run ──────────────────────────────────────────────────
(async () => {
  console.log(`🔌 Connexion Supabase: ${SUPABASE_URL}`);
  const authorSlugToId = await importAuthors();
  await importPosts(authorSlugToId);
  console.log("\n🎉 Migration terminée");
})();
