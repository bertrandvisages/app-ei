-- Dernieres colonnes au nom herite de l ancien site, sur la table `articles`.
--
-- NE PAS EXECUTER SEUL : le site Astro les nomme dans son SELECT
-- (src/lib/content.ts) et le dashboard les lit aussi. Lance ce script, puis
-- previens-moi dans la minute : je pousse les deux repos tout de suite apres.
-- Entre les deux, un rebuild du site echouerait sur
-- « column articles.wordpress_post_id does not exist ».
--
-- La table est vide en pratique (aucune actualite publiee, le carrousel de la
-- home ne rend rien), donc aucune donnee a risque.

ALTER TABLE public.articles
  RENAME COLUMN wordpress_post_id TO legacy_post_id;

ALTER TABLE public.articles
  RENAME COLUMN wordpress_url TO legacy_url;

COMMENT ON COLUMN public.articles.legacy_post_id IS
  'Identifiant de l article sur l ancien site. Sert encore de cle pour les actualites importees.';
COMMENT ON COLUMN public.articles.legacy_url IS
  'URL de l article sur l ancien site. Jamais affichee par le site public.';
