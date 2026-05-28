-- Table `pages` : stocke les overrides de texte des pages statiques du site.
--
-- Modèle : chaque ligne = une page identifiée par son slug.
-- La colonne `content` (JSONB) contient les surcharges des chaînes affichées.
-- Le site Astro a les valeurs par défaut codées en dur dans le .astro et
-- applique l'override quand la clé existe (sinon fallback sur le défaut).
--
-- Pas d'INSERT initial : la table est vide au début. Quand l'éditeur saisit
-- la première modification d'une page, l'API fait un UPSERT.
--
-- À appliquer AVANT le déploiement du code qui lit cette table.

CREATE TABLE IF NOT EXISTS public.pages (
  slug TEXT PRIMARY KEY,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  seo_title TEXT,
  seo_description TEXT,
  status TEXT NOT NULL DEFAULT 'publie' CHECK (status IN ('draft', 'publie')),
  published_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Mêmes triggers que les autres tables : touch updated_at à chaque UPDATE
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pages_set_updated_at ON public.pages;
CREATE TRIGGER pages_set_updated_at
  BEFORE UPDATE ON public.pages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS : lecture publique (le site Astro la lit en build via clé anon),
-- écriture authentifiée uniquement (le dashboard, via cookie de session).
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pages_read_public" ON public.pages;
CREATE POLICY "pages_read_public" ON public.pages
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "pages_write_authenticated" ON public.pages;
CREATE POLICY "pages_write_authenticated" ON public.pages
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.pages IS
  'Overrides de texte des pages statiques. content JSONB = override des chaînes par defaults codes en dur dans le .astro.';
COMMENT ON COLUMN public.pages.content IS
  'JSON arbitraire suivant le schema déclaré par page côté dashboard. Cles non présentes = fallback sur valeur par défaut du .astro.';
