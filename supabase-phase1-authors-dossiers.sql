-- ============================================
-- Phase 1 : Tables authors, dossiers, contributions, inscrits
-- + ALTER articles pour FK author_id
-- + Rewrite trigger handle_new_user (route entre profiles et inscrits)
--
-- À exécuter dans Supabase Studio → SQL Editor
-- Idempotent : CREATE IF NOT EXISTS / DROP TRIGGER IF EXISTS
-- ============================================

-- ─── AUTHORS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.authors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wp_id INTEGER UNIQUE,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  bio TEXT,
  job_title TEXT,
  company TEXT,
  company_website TEXT,
  linkedin TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_authors_slug ON public.authors(slug);

ALTER TABLE public.authors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture publique authors" ON public.authors;
CREATE POLICY "Lecture publique authors"
  ON public.authors FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Modif authors par authentifies" ON public.authors;
CREATE POLICY "Modif authors par authentifies"
  ON public.authors FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP TRIGGER IF EXISTS update_authors_updated_at ON public.authors;
CREATE TRIGGER update_authors_updated_at
  BEFORE UPDATE ON public.authors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ─── DOSSIERS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dossiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wp_id INTEGER UNIQUE,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  excerpt TEXT,
  cover_image_url TEXT,
  author_id UUID REFERENCES public.authors(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','publie','archive')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dossiers_status_order ON public.dossiers(status, sort_order);
CREATE INDEX IF NOT EXISTS idx_dossiers_slug ON public.dossiers(slug);
CREATE INDEX IF NOT EXISTS idx_dossiers_author_id ON public.dossiers(author_id);

ALTER TABLE public.dossiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture publique dossiers publiés" ON public.dossiers;
CREATE POLICY "Lecture publique dossiers publiés"
  ON public.dossiers FOR SELECT
  USING (status = 'publie' OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Modif dossiers par authentifies" ON public.dossiers;
CREATE POLICY "Modif dossiers par authentifies"
  ON public.dossiers FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP TRIGGER IF EXISTS update_dossiers_updated_at ON public.dossiers;
CREATE TRIGGER update_dossiers_updated_at
  BEFORE UPDATE ON public.dossiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ─── CONTRIBUTIONS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wp_id INTEGER UNIQUE,
  dossier_id UUID NOT NULL REFERENCES public.dossiers(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.authors(id) ON DELETE SET NULL,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  excerpt TEXT,
  cover_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','publie','archive')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contributions_dossier_status ON public.contributions(dossier_id, status);
CREATE INDEX IF NOT EXISTS idx_contributions_slug ON public.contributions(slug);
CREATE INDEX IF NOT EXISTS idx_contributions_author_id ON public.contributions(author_id);

ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture publique contributions publiées" ON public.contributions;
CREATE POLICY "Lecture publique contributions publiées"
  ON public.contributions FOR SELECT
  USING (status = 'publie' OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Modif contributions par authentifies" ON public.contributions;
CREATE POLICY "Modif contributions par authentifies"
  ON public.contributions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP TRIGGER IF EXISTS update_contributions_updated_at ON public.contributions;
CREATE TRIGGER update_contributions_updated_at
  BEFORE UPDATE ON public.contributions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ─── INSCRITS (visiteurs signups via /inscription) ────────
CREATE TABLE IF NOT EXISTS public.inscrits (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  departement TEXT,
  user_type TEXT CHECK (user_type IN ('distributeur','investisseur')),
  societe TEXT,
  investisseur_type TEXT CHECK (investisseur_type IN ('professionnel','averti','non_professionnel')),
  newsletter BOOLEAN NOT NULL DEFAULT false,
  recontacter BOOLEAN NOT NULL DEFAULT false,
  cgu BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inscrits_email ON public.inscrits(email);
CREATE INDEX IF NOT EXISTS idx_inscrits_user_type ON public.inscrits(user_type);

ALTER TABLE public.inscrits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Inscrit voit son propre profil" ON public.inscrits;
CREATE POLICY "Inscrit voit son propre profil"
  ON public.inscrits FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Inscrit modifie son propre profil" ON public.inscrits;
CREATE POLICY "Inscrit modifie son propre profil"
  ON public.inscrits FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins voient tous les inscrits" ON public.inscrits;
CREATE POLICY "Admins voient tous les inscrits"
  ON public.inscrits FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin','editeur')
    )
  );

DROP TRIGGER IF EXISTS update_inscrits_updated_at ON public.inscrits;
CREATE TRIGGER update_inscrits_updated_at
  BEFORE UPDATE ON public.inscrits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ─── REWRITE handle_new_user : route entre profiles et inscrits ───
-- Si raw_user_meta_data contient user_type → c'est un signup via /inscription → INSERT inscrits
-- Sinon → c'est un admin/éditeur créé par invitation → INSERT profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_user_type TEXT;
BEGIN
  v_user_type := NEW.raw_user_meta_data->>'user_type';

  IF v_user_type IS NOT NULL THEN
    -- Visiteur inscrit via /inscription
    INSERT INTO public.inscrits (
      id, email,
      first_name, last_name, departement,
      user_type, societe, investisseur_type,
      newsletter, recontacter, cgu
    ) VALUES (
      NEW.id,
      NEW.email,
      NEW.raw_user_meta_data->>'first_name',
      NEW.raw_user_meta_data->>'last_name',
      NEW.raw_user_meta_data->>'departement',
      v_user_type,
      NULLIF(NEW.raw_user_meta_data->>'societe', ''),
      NULLIF(NEW.raw_user_meta_data->>'investisseur_type', ''),
      COALESCE((NEW.raw_user_meta_data->>'newsletter')::boolean, false),
      COALESCE((NEW.raw_user_meta_data->>'recontacter')::boolean, false),
      COALESCE((NEW.raw_user_meta_data->>'cgu')::boolean, false)
    );
  ELSE
    -- Admin/éditeur du dashboard
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        NEW.email
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── ARTICLES : ajout FK author_id ────────────────────────
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES public.authors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_articles_author_id ON public.articles(author_id);


-- ─── Vérification rapide (à exécuter manuellement après) ───
-- SELECT count(*) FROM public.authors;        -- 0 avant migration
-- SELECT count(*) FROM public.dossiers;       -- 0
-- SELECT count(*) FROM public.contributions;  -- 0
-- SELECT count(*) FROM public.inscrits;       -- 0 (sauf si signups en attente)
