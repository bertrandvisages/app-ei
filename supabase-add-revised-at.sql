-- Date de mise à jour éditoriale des dossiers et des opinions.
-- À appliquer AVANT le déploiement du code qui la lit (sinon les SELECT
-- du site Astro plantent avec `column does not exist`).
--
-- Lancer dans Supabase Studio → SQL Editor → coller → Run.
-- Idempotent : `IF NOT EXISTS` permet de relancer sans erreur.
--
-- Type `date` et non `timestamptz` : l'éditeur choisit un jour, pas une
-- heure. Un timestamp à minuit UTC s'afficherait la veille dans tout fuseau
-- négatif, et le conteneur de build tourne en UTC.

ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS revised_at DATE;

ALTER TABLE public.contributions
  ADD COLUMN IF NOT EXISTS revised_at DATE;

COMMENT ON COLUMN public.dossiers.revised_at IS
  'Date de mise à jour éditoriale, saisie à la main dans le dashboard. NULL = jamais mis à jour, le site n''affiche alors que la date de publication. Ne pas confondre avec updated_at, horodatage machine qui bouge à chaque sauvegarde.';
COMMENT ON COLUMN public.contributions.revised_at IS
  'Date de mise à jour éditoriale, saisie à la main dans le dashboard. NULL = jamais mis à jour, le site n''affiche alors que la date de publication. Ne pas confondre avec updated_at, horodatage machine qui bouge à chaque sauvegarde.';
