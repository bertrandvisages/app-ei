-- Ajoute les champs SEO custom aux entités éditoriales.
-- À appliquer AVANT le déploiement du code qui les lit (sinon les SELECT
-- du site Astro plantent avec `column does not exist`).
--
-- Lancer dans Supabase Studio → SQL Editor → coller → Run.
-- Idempotent : `IF NOT EXISTS` permet de relancer sans erreur.

ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS seo_title TEXT,
  ADD COLUMN IF NOT EXISTS seo_description TEXT;

ALTER TABLE public.contributions
  ADD COLUMN IF NOT EXISTS seo_title TEXT,
  ADD COLUMN IF NOT EXISTS seo_description TEXT;

COMMENT ON COLUMN public.dossiers.seo_title IS
  'Meta title custom utilisé tel quel par le site (sans suffixe). Si NULL, fallback sur le titre normal.';
COMMENT ON COLUMN public.dossiers.seo_description IS
  'Meta description custom. Si NULL, fallback sur l''excerpt.';
COMMENT ON COLUMN public.contributions.seo_title IS
  'Meta title custom utilisé tel quel par le site (sans suffixe). Si NULL, fallback sur le titre normal.';
COMMENT ON COLUMN public.contributions.seo_description IS
  'Meta description custom. Si NULL, fallback sur citation/excerpt.';
