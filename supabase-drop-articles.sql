-- Suppression de la table des actualites.
--
-- Rubrique abandonnee : 14 lignes, toutes au statut « publie », mais aucune
-- n'est affichee nulle part. Le composant du carrousel existe encore
-- (lenoncote/src/components/home/Actualites.astro) et n'est importe par
-- aucune page.
--
-- CE SCRIPT REMPLACE supabase-rename-legacy-columns.sql : wordpress_post_id
-- et wordpress_url n'existent que sur cette table. La supprimer fait
-- disparaitre les deux dernieres colonnes au nom herite de WordPress, le
-- renommage n'a donc plus lieu d'etre.
--
-- SAUVEGARDE FAITE AVANT : backups/articles-2026-11-25.json
-- 14 lignes completes, 19 colonnes, 21 Ko. A conserver, le DROP est definitif.
--
-- ───────────────────────────────────────────────────────────────────────
-- ORDRE OBLIGATOIRE, et c'est l'INVERSE de l'ordre habituel.
--
-- D'habitude on fait le ALTER d'abord et le code ensuite. Ici c'est le
-- contraire : lenoncote/src/lib/content.ts fait un SELECT sur cette table a
-- chaque build et leve une exception si la requete echoue
-- (« [content] Fetch articles failed »). Tant que ce code est en ligne,
-- supprimer la table casse TOUS les builds du site, donc toute publication.
--
--   1. je retire le code des deux depots et je pousse
--   2. un build de prod passe au vert
--   3. seulement la, tu lances ce script
-- ───────────────────────────────────────────────────────────────────────

-- Verification prealable : qui depend de cette table ?
-- Doit renvoyer zero ligne. Aucune cle etrangere n'est declaree vers
-- `articles` dans les scripts du depot, mais une contrainte a pu etre
-- ajoutee a la main dans Studio.
SELECT conrelid::regclass AS table_dependante, conname AS contrainte
FROM pg_constraint
WHERE confrelid = 'public.articles'::regclass;

-- RESTRICT est explicite a dessein : si une vue ou une contrainte depend
-- encore de la table, Postgres refuse de la supprimer au lieu de detruire
-- en cascade. En cas de refus, lis le message avant de forcer quoi que ce
-- soit.
DROP TABLE public.articles RESTRICT;
