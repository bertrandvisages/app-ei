-- Ajoute le flag `homepage` aux entités éditoriales.
-- Sert à mettre en avant un dossier / une opinion sur la page d'accueil du site.
-- À appliquer AVANT le déploiement du code qui le lit (sinon les SELECT
-- plantent avec `column does not exist`).
--
-- Lancer dans Supabase Studio → SQL Editor → coller → Run.
-- Idempotent : `IF NOT EXISTS` permet de relancer sans erreur.

ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS homepage BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.contributions
  ADD COLUMN IF NOT EXISTS homepage BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.dossiers.homepage IS
  'Si true, le dossier est mis en avant sur la page d''accueil du site.';
COMMENT ON COLUMN public.contributions.homepage IS
  'Si true, l''opinion est mise en avant sur la page d''accueil du site.';
