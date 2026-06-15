-- ============================================
-- Publication programmée des dossiers et opinions
--
-- Ajoute un status 'programme' + une colonne scheduled_publish_at +
-- un job pg_cron qui tourne tous les jours à 5h (heure de Paris,
-- approximation via UTC) pour basculer les posts dont la date est
-- atteinte vers le status 'publie' et déclencher un rebuild Coolify.
--
-- À exécuter dans Supabase Studio → SQL Editor.
-- Idempotent : peut être relancé.
--
-- Pré-requis : extensions pg_cron et pg_net activées dans Supabase
-- (Database → Extensions).
-- ============================================

-- ─── EXTENSIONS ──────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ─── COLONNES ────────────────────────────────────────────────────
ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS scheduled_publish_at TIMESTAMPTZ;

ALTER TABLE public.contributions
  ADD COLUMN IF NOT EXISTS scheduled_publish_at TIMESTAMPTZ;

COMMENT ON COLUMN public.dossiers.scheduled_publish_at IS
  'Date de mise en ligne programmée. Combiné avec status=''programme''. Le cron publish_scheduled_posts() bascule vers status=''publie'' quand l''heure est atteinte.';
COMMENT ON COLUMN public.contributions.scheduled_publish_at IS
  'Date de mise en ligne programmée. Cf. dossiers.scheduled_publish_at.';

-- Index partiel pour accélérer la recherche du cron (uniquement les
-- lignes programmées non encore publiées).
CREATE INDEX IF NOT EXISTS idx_dossiers_scheduled
  ON public.dossiers (scheduled_publish_at)
  WHERE status = 'programme';
CREATE INDEX IF NOT EXISTS idx_contributions_scheduled
  ON public.contributions (scheduled_publish_at)
  WHERE status = 'programme';

-- ─── FONCTION DE BASCULE ─────────────────────────────────────────
-- Cherche les posts dont la date programmée est passée, les flip vers
-- 'publie', positionne published_at = scheduled_publish_at, vide
-- scheduled_publish_at, et déclenche un rebuild Coolify si au moins
-- un post a été publié.
--
-- Le webhook Coolify et le bearer token sont stockés en GUC postgres
-- (à setter une fois — voir bloc DO plus bas).
CREATE OR REPLACE FUNCTION public.publish_scheduled_posts()
RETURNS TABLE (table_name TEXT, published_count INT) AS $$
DECLARE
  dossiers_count INT;
  contribs_count INT;
  webhook_url TEXT;
  webhook_token TEXT;
  total INT;
BEGIN
  -- Dossiers : flip programme -> publie
  WITH updated AS (
    UPDATE public.dossiers
       SET status = 'publie',
           published_at = scheduled_publish_at,
           scheduled_publish_at = NULL
     WHERE status = 'programme'
       AND scheduled_publish_at IS NOT NULL
       AND scheduled_publish_at <= now()
     RETURNING id
  )
  SELECT count(*) INTO dossiers_count FROM updated;

  -- Contributions / opinions : pareil
  WITH updated AS (
    UPDATE public.contributions
       SET status = 'publie',
           published_at = scheduled_publish_at,
           scheduled_publish_at = NULL
     WHERE status = 'programme'
       AND scheduled_publish_at IS NOT NULL
       AND scheduled_publish_at <= now()
     RETURNING id
  )
  SELECT count(*) INTO contribs_count FROM updated;

  total := COALESCE(dossiers_count, 0) + COALESCE(contribs_count, 0);

  -- Si au moins un post a été publié, on bump last_deploy_at + on
  -- POST le webhook Coolify pour déclencher un rebuild Astro.
  IF total > 0 THEN
    -- Bump last_deploy_at maintenant : le compteur "publications en
    -- attente" du dashboard repassera à 0 dès que le cron a tourné.
    UPDATE public.site_meta
       SET last_deploy_at = now()
     WHERE id = 1;

    -- Récupère le webhook + token depuis les GUC postgres
    webhook_url := current_setting('app.coolify_webhook_url', true);
    webhook_token := current_setting('app.coolify_token', true);

    IF webhook_url IS NOT NULL AND webhook_url <> '' THEN
      PERFORM net.http_get(
        url := webhook_url,
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || COALESCE(webhook_token, '')
        )
      );
    END IF;
  END IF;

  RETURN QUERY VALUES
    ('dossiers'::TEXT, COALESCE(dossiers_count, 0)),
    ('contributions'::TEXT, COALESCE(contribs_count, 0));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── CONFIGURATION DU WEBHOOK ───────────────────────────────────
-- ⚠️ À FAIRE UNE SEULE FOIS, manuellement, en remplaçant les valeurs
-- ci-dessous par les vraies URLs/tokens Coolify (les mêmes que ceux
-- utilisés en runtime par DASH-EI : COOLIFY_DEPLOY_WEBHOOK_URL et
-- COOLIFY_API_TOKEN). Décommente et exécute dans Supabase :
--
-- ALTER DATABASE postgres
--   SET app.coolify_webhook_url = 'https://...coolify.../api/v1/deploy?uuid=...&force=false';
-- ALTER DATABASE postgres
--   SET app.coolify_token = 'le-bearer-token';
--
-- Puis reconnecte la session SQL Editor (ou attends 1 min) pour que
-- les nouveaux settings soient pris en compte. Test :
--   SELECT current_setting('app.coolify_webhook_url', true);

-- ─── PLANIFICATION DU JOB ───────────────────────────────────────
-- 5h heure de Paris ≈ 4h UTC (l'écart varie entre 3h en été et 4h en
-- hiver à cause de l'heure d'été ; on cale sur 4h UTC = 5h hiver, 6h
-- été — suffisant pour une publication matinale).
--
-- Si pg_cron de ton instance supporte cron.schedule_in_timezone() (≥1.5),
-- tu peux remplacer par :
--   SELECT cron.schedule_in_timezone(
--     'publish-scheduled-posts',
--     '0 5 * * *',
--     'Europe/Paris',
--     $$SELECT public.publish_scheduled_posts();$$
--   );

-- On supprime le job précédent au cas où on relance le SQL
SELECT cron.unschedule('publish-scheduled-posts')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'publish-scheduled-posts'
  );

SELECT cron.schedule(
  'publish-scheduled-posts',
  '0 4 * * *',
  $$SELECT public.publish_scheduled_posts();$$
);

-- ─── VÉRIFICATIONS ──────────────────────────────────────────────
-- SELECT * FROM cron.job WHERE jobname = 'publish-scheduled-posts';
-- SELECT * FROM public.publish_scheduled_posts();   -- exécution manuelle
