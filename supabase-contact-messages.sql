-- Table `contact_messages` : stocke les messages envoyés via le formulaire
-- /nous-contacter du site. L'API /api/contact insère ici en best-effort
-- (l'envoi email reste prioritaire si l'INSERT échoue).
--
-- Le dashboard /dashboard/messages liste, affiche et supprime ces messages.
-- Statut "non_lu" par défaut, passe à "lu" quand un éditeur ouvre le message.
--
-- À appliquer dans Supabase Studio → SQL Editor.

CREATE TABLE IF NOT EXISTS public.contact_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'non_lu' CHECK (status IN ('non_lu', 'lu')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_status_created
  ON public.contact_messages(status, created_at DESC);

-- Trigger updated_at — reutilise la fonction set_updated_at() deja en place
-- pour les autres tables (dossiers, contributions, etc.).
DROP TRIGGER IF EXISTS contact_messages_set_updated_at ON public.contact_messages;
CREATE TRIGGER contact_messages_set_updated_at
  BEFORE UPDATE ON public.contact_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS : authenticated peut tout faire. L'API /api/contact qui insère est
-- côté serveur Next.js et utilise le service_role (bypass RLS), donc pas
-- besoin de policy publique INSERT.
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contact_messages_authenticated_all" ON public.contact_messages;
CREATE POLICY "contact_messages_authenticated_all" ON public.contact_messages
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.contact_messages IS
  'Messages soumis via /nous-contacter sur le site public. Lus/supprimes via /dashboard/messages.';
