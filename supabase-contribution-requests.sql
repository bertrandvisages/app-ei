-- Table `contribution_requests` : demandes de contribution soumises via le
-- formulaire /devenir-contributeur du site public.
--
-- Chaque demande contient les coordonnees du candidat, son pitch + sa
-- contribution (texte long), et une liste de fichiers joints (images,
-- documents Word, PDF…) stockes dans Supabase Storage et reference dans
-- la colonne attachments JSONB.
--
-- L'API publique /api/contribution-requests (POST) bypass RLS via
-- service_role. Le dashboard utilise la session cookie utilisateur et la
-- policy authenticated_all ci-dessous.

CREATE TABLE IF NOT EXISTS public.contribution_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  linkedin TEXT,
  website TEXT,
  role TEXT,
  company TEXT,
  message TEXT,
  contribution TEXT NOT NULL,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'non_lu' CHECK (status IN ('non_lu', 'lu')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contribution_requests_status_created
  ON public.contribution_requests(status, created_at DESC);

DROP TRIGGER IF EXISTS contribution_requests_set_updated_at ON public.contribution_requests;
CREATE TRIGGER contribution_requests_set_updated_at
  BEFORE UPDATE ON public.contribution_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.contribution_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contribution_requests_authenticated_all" ON public.contribution_requests;
CREATE POLICY "contribution_requests_authenticated_all" ON public.contribution_requests
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.contribution_requests IS
  'Demandes de contribution soumises via /devenir-contributeur. Lues/supprimees via /dashboard/demandes. attachments = array de { name, url, content_type, size_bytes }.';
