-- Table notifications pour les callbacks async (ex: image ready)
CREATE TABLE public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  post_id INTEGER,
  image_url TEXT,
  image_id INTEGER,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Les utilisateurs authentifiés peuvent voir les notifications"
  ON public.notifications FOR SELECT TO authenticated USING (true);

CREATE POLICY "Insertion notifications"
  ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

-- Allow service_role to insert (no RLS bypass needed, service_role bypasses RLS)

CREATE POLICY "Mise à jour notifications"
  ON public.notifications FOR UPDATE TO authenticated USING (true);
