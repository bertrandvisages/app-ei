-- Table `tickets` : demandes de modification du site cree par les editeurs
-- depuis le dashboard. Chaque ticket cree envoie un email a mac@visages.biz
-- (le dev). Les editeurs peuvent les modifier, les supprimer et les tagger
-- traite/non_traite.

CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'non_traite' CHECK (status IN ('non_traite', 'traite')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tickets_status_created
  ON public.tickets(status, created_at DESC);

-- Trigger updated_at — reutilise la fonction set_updated_at() partagee
DROP TRIGGER IF EXISTS tickets_set_updated_at ON public.tickets;
CREATE TRIGGER tickets_set_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS : authenticated full access. Tout editeur peut voir et modifier
-- tous les tickets (pas de cloisonnement par auteur).
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tickets_authenticated_all" ON public.tickets;
CREATE POLICY "tickets_authenticated_all" ON public.tickets
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.tickets IS
  'Demandes de modification du site emises depuis le dashboard. Envoie email a mac@visages.biz a la creation.';
