-- Table des abonnés WordPress
CREATE TABLE public.subscribers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wp_user_id INTEGER UNIQUE NOT NULL,
  login TEXT,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  user_type TEXT,
  investisseur_type TEXT,
  societe TEXT,
  departement TEXT,
  newsletter BOOLEAN DEFAULT false,
  recontacter BOOLEAN DEFAULT false,
  cgu BOOLEAN DEFAULT false,
  email_verified BOOLEAN DEFAULT false,
  registered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscribers_email ON public.subscribers(email);
CREATE INDEX idx_subscribers_user_type ON public.subscribers(user_type);
CREATE INDEX idx_subscribers_newsletter ON public.subscribers(newsletter);

ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Les utilisateurs authentifiés peuvent voir les abonnés"
  ON public.subscribers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Insertion abonnés via service_role"
  ON public.subscribers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Mise à jour abonnés"
  ON public.subscribers FOR UPDATE
  TO authenticated
  USING (true);

CREATE TRIGGER update_subscribers_updated_at
  BEFORE UPDATE ON public.subscribers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
