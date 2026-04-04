-- Migration pour adapter le schema au flux n8n
-- A exécuter dans le SQL Editor de Supabase

-- Supprimer les anciennes colonnes et ajouter les nouvelles
ALTER TABLE public.articles DROP COLUMN IF EXISTS link;
ALTER TABLE public.articles DROP COLUMN IF EXISTS url;
ALTER TABLE public.articles DROP COLUMN IF EXISTS secteur;

-- Renommer les colonnes existantes
ALTER TABLE public.articles RENAME COLUMN titre TO title;
ALTER TABLE public.articles RENAME COLUMN description TO content;
ALTER TABLE public.articles RENAME COLUMN date_source TO date_source;

-- Ajouter les nouvelles colonnes
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS source_name TEXT;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT '{}';
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Mettre à jour la contrainte de status pour inclure 'draft'
ALTER TABLE public.articles DROP CONSTRAINT IF EXISTS articles_status_check;
ALTER TABLE public.articles ADD CONSTRAINT articles_status_check
  CHECK (status IN ('draft', 'valide', 'publie', 'rejete'));

-- Mettre à jour les articles existants si nécessaire
UPDATE public.articles SET status = 'draft' WHERE status = 'brouillon';

-- Recréer les index
DROP INDEX IF EXISTS idx_articles_secteur;
CREATE INDEX IF NOT EXISTS idx_articles_categories ON public.articles USING GIN(categories);
CREATE INDEX IF NOT EXISTS idx_articles_source_name ON public.articles(source_name);
