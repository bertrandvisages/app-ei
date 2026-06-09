-- ============================================
-- site_meta : table singleton qui stocke last_deploy_at
-- Sert au compteur "X publications en attente" du bouton "Mettre à jour le site"
--
-- À exécuter dans Supabase Studio → SQL Editor
-- Idempotent
-- ============================================

CREATE TABLE IF NOT EXISTS public.site_meta (
  id INT PRIMARY KEY DEFAULT 1,
  last_deploy_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT site_meta_singleton CHECK (id = 1)
);

INSERT INTO public.site_meta (id, last_deploy_at)
VALUES (1, now())
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.site_meta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read site_meta" ON public.site_meta;
CREATE POLICY "Authenticated can read site_meta" ON public.site_meta
  FOR SELECT TO authenticated USING (true);

-- Pas de policy d'UPDATE : les écritures passent par service_role
-- (route /api/wordpress/deploy)
