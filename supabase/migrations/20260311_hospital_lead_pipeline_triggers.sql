-- ============================================================================
-- Triggers for Hospital → Director → Lead automation pipeline
-- + Lead auto-qualify + pg_cron scheduled maintenance
-- ============================================================================

-- ── Trigger 1: Auto-enrich hospital on INSERT ──────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_auto_enrich_hospital()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Skip if already enriched
  IF NEW.enriched = true THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://lciaprvesogbwolaowsj.supabase.co/functions/v1/auto-enrich-hospital',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'HospitalLead',
      'schema', 'public',
      'record', row_to_json(NEW)::jsonb,
      'old_record', null
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_enrich_hospital ON "HospitalLead";
CREATE TRIGGER trg_auto_enrich_hospital
  AFTER INSERT ON "HospitalLead"
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_auto_enrich_hospital();

-- ── Trigger 2: Auto-find director when enriched changes to true ────────────
CREATE OR REPLACE FUNCTION public.notify_auto_find_director()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only fire when enriched changes from false/null to true AND no director yet
  IF NEW.enriched = true
     AND (OLD.enriched IS NULL OR OLD.enriched = false)
     AND (NEW."directorName" IS NULL OR NEW."directorName" = '')
  THEN
    PERFORM net.http_post(
      url := 'https://lciaprvesogbwolaowsj.supabase.co/functions/v1/auto-find-director',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object(
        'type', 'UPDATE',
        'table', 'HospitalLead',
        'schema', 'public',
        'record', row_to_json(NEW)::jsonb,
        'old_record', row_to_json(OLD)::jsonb
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_find_director ON "HospitalLead";
CREATE TRIGGER trg_auto_find_director
  AFTER UPDATE ON "HospitalLead"
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_auto_find_director();

-- ── Trigger 3: Auto-enrich lead on INSERT (director/hospital/manual only) ──
CREATE OR REPLACE FUNCTION public.notify_auto_enrich_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only enrich director/hospital/manual sources — scraped leads have data
  IF NEW.source IN ('residency_director', 'hospital', 'manual') THEN
    PERFORM net.http_post(
      url := 'https://lciaprvesogbwolaowsj.supabase.co/functions/v1/auto-enrich-lead',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object(
        'type', 'INSERT',
        'table', 'Lead',
        'schema', 'public',
        'record', row_to_json(NEW)::jsonb,
        'old_record', null
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_enrich_lead ON "Lead";
CREATE TRIGGER trg_auto_enrich_lead
  AFTER INSERT ON "Lead"
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_auto_enrich_lead();

-- ── Trigger 4: Auto-qualify lead when enrichment data changes ──────────────
CREATE OR REPLACE FUNCTION public.notify_auto_qualify_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only fire when enrichment fields change (email, notes, rating)
  IF (NEW.email IS DISTINCT FROM OLD.email)
     OR (NEW.notes IS DISTINCT FROM OLD.notes)
     OR (NEW.rating IS DISTINCT FROM OLD.rating)
  THEN
    -- Don't re-qualify if already qualified or beyond
    IF NEW.status NOT IN ('qualified', 'contacted', 'converted', 'archived') THEN
      PERFORM net.http_post(
        url := 'https://lciaprvesogbwolaowsj.supabase.co/functions/v1/auto-qualify-lead',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := jsonb_build_object(
          'type', 'UPDATE',
          'table', 'Lead',
          'schema', 'public',
          'record', row_to_json(NEW)::jsonb,
          'old_record', row_to_json(OLD)::jsonb
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_qualify_lead ON "Lead";
CREATE TRIGGER trg_auto_qualify_lead
  AFTER UPDATE ON "Lead"
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_auto_qualify_lead();

-- ── Trigger 5: Re-enrich hospital when URL changes ────────────────────────
CREATE OR REPLACE FUNCTION public.notify_re_enrich_hospital_url()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.url IS NOT NULL AND NEW.url != ''
     AND (OLD.url IS NULL OR NEW.url != OLD.url)
  THEN
    PERFORM net.http_post(
      url := 'https://lciaprvesogbwolaowsj.supabase.co/functions/v1/auto-enrich-hospital',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object(
        'type', 'INSERT',
        'table', 'HospitalLead',
        'schema', 'public',
        'record', row_to_json(NEW)::jsonb,
        'old_record', row_to_json(OLD)::jsonb
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_re_enrich_hospital_url ON "HospitalLead";
CREATE TRIGGER trg_re_enrich_hospital_url
  AFTER UPDATE ON "HospitalLead"
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_re_enrich_hospital_url();

-- ── Phase 4: pg_cron scheduled maintenance ─────────────────────────────────
-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule: Daily at 2am UTC — re-enrich stale leads
SELECT cron.schedule(
  're-enrich-stale-leads',
  '0 2 * * *',
  $$
  -- Re-enrich leads missing email, created > 7 days ago, not updated recently
  SELECT net.http_post(
    url := 'https://lciaprvesogbwolaowsj.supabase.co/functions/v1/auto-enrich-lead',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'Lead',
      'schema', 'public',
      'record', row_to_json(l)::jsonb,
      'old_record', null
    )
  )
  FROM "Lead" l
  WHERE l.email IS NULL
    AND l.source IN ('residency_director', 'hospital', 'manual')
    AND l."createdAt" < now() - interval '7 days'
    AND l."updatedAt" < now() - interval '3 days'
  LIMIT 20;
  $$
);

-- Schedule: Weekly on Sunday at 3am UTC — archive very old untouched leads
SELECT cron.schedule(
  'archive-stale-leads',
  '0 3 * * 0',
  $$
  UPDATE "Lead"
  SET status = 'archived', "updatedAt" = now()
  WHERE status = 'new'
    AND "createdAt" < now() - interval '90 days'
    AND "updatedAt" < now() - interval '30 days';
  $$
);

-- Schedule: Daily at 2:30am UTC — re-enrich un-enriched hospitals
SELECT cron.schedule(
  're-enrich-hospitals',
  '30 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://lciaprvesogbwolaowsj.supabase.co/functions/v1/auto-enrich-hospital',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'HospitalLead',
      'schema', 'public',
      'record', row_to_json(h)::jsonb,
      'old_record', null
    )
  )
  FROM "HospitalLead" h
  WHERE h.enriched = false OR h.enriched IS NULL
  LIMIT 10;
  $$
);
