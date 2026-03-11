-- Trigger 1: Auto-research grants with URLs on insert
CREATE OR REPLACE FUNCTION public.notify_auto_research_grant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only fire if the grant has a URL
  IF NEW.url IS NOT NULL AND NEW.url != '' THEN
    PERFORM net.http_post(
      url := 'https://lciaprvesogbwolaowsj.supabase.co/functions/v1/auto-research-grant',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object(
        'type', 'INSERT',
        'table', 'Grant',
        'schema', 'public',
        'record', row_to_json(NEW)::jsonb
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_research_grant ON "Grant";
CREATE TRIGGER trg_auto_research_grant
  AFTER INSERT ON "Grant"
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_auto_research_grant();

-- Trigger 2: Re-analyse all grants when GrantProfile is updated
CREATE OR REPLACE FUNCTION public.notify_reanalyse_on_profile_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://lciaprvesogbwolaowsj.supabase.co/functions/v1/re-analyse-on-profile-change',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object(
      'type', 'UPDATE',
      'table', 'GrantProfile',
      'schema', 'public',
      'record', row_to_json(NEW)::jsonb,
      'old_record', row_to_json(OLD)::jsonb
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reanalyse_on_profile_change ON "GrantProfile";
CREATE TRIGGER trg_reanalyse_on_profile_change
  AFTER UPDATE ON "GrantProfile"
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_reanalyse_on_profile_change();
