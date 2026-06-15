-- Ajoute les champs SEO custom à la table authors.
-- À appliquer AVANT le déploiement du code qui les lit (sinon les SELECT
-- du site Astro plantent avec `column does not exist`).
--
-- Lancer dans Supabase Studio → SQL Editor → coller → Run.
-- Idempotent : `IF NOT EXISTS` permet de relancer sans erreur.

ALTER TABLE public.authors
  ADD COLUMN IF NOT EXISTS seo_title TEXT,
  ADD COLUMN IF NOT EXISTS seo_description TEXT;

COMMENT ON COLUMN public.authors.seo_title IS
  'Meta title custom utilisé tel quel par la page auteur du site (sans suffixe). Si NULL, fallback sur le nom.';
COMMENT ON COLUMN public.authors.seo_description IS
  'Meta description custom de la page auteur. Si NULL, fallback sur bio/job_title.';
