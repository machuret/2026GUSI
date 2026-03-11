-- Add aiBrief column to Grant table for pre-generated writing briefs
ALTER TABLE "Grant" ADD COLUMN IF NOT EXISTS "aiBrief" jsonb;

-- Trigger 1: Auto-score complexity when aiScore is set (analyse completes)
CREATE OR REPLACE FUNCTION public.notify_auto_complexity_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only fire when aiScore changes from NULL to a value and complexityScore is still NULL
  IF NEW."aiScore" IS NOT NULL AND OLD."aiScore" IS NULL AND NEW."complexityScore" IS NULL THEN
    PERFORM net.http_post(
      url := 'https://lciaprvesogbwolaowsj.supabase.co/functions/v1/auto-complexity-score',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object(
        'type', 'UPDATE',
        'table', 'Grant',
        'schema', 'public',
        'record', row_to_json(NEW)::jsonb,
        'old_record', row_to_json(OLD)::jsonb
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_complexity_score ON "Grant";
CREATE TRIGGER trg_auto_complexity_score
  AFTER UPDATE ON "Grant"
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_auto_complexity_score();

-- Trigger 2: Auto-generate brief when aiScore is set (analyse completes)
CREATE OR REPLACE FUNCTION public.notify_auto_generate_brief()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only fire when aiScore changes from NULL to a value and aiBrief is still NULL
  IF NEW."aiScore" IS NOT NULL AND OLD."aiScore" IS NULL AND NEW."aiBrief" IS NULL THEN
    PERFORM net.http_post(
      url := 'https://lciaprvesogbwolaowsj.supabase.co/functions/v1/auto-generate-brief',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object(
        'type', 'UPDATE',
        'table', 'Grant',
        'schema', 'public',
        'record', row_to_json(NEW)::jsonb,
        'old_record', row_to_json(OLD)::jsonb
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_generate_brief ON "Grant";
CREATE TRIGGER trg_auto_generate_brief
  AFTER UPDATE ON "Grant"
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_auto_generate_brief();

-- Trigger 3: Re-research when URL changes
CREATE OR REPLACE FUNCTION public.notify_re_research_on_url_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only fire when URL actually changes to a non-empty value
  IF NEW.url IS NOT NULL AND NEW.url != '' AND (OLD.url IS NULL OR NEW.url != OLD.url) THEN
    PERFORM net.http_post(
      url := 'https://lciaprvesogbwolaowsj.supabase.co/functions/v1/re-research-on-url-change',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object(
        'type', 'UPDATE',
        'table', 'Grant',
        'schema', 'public',
        'record', row_to_json(NEW)::jsonb,
        'old_record', row_to_json(OLD)::jsonb
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_re_research_on_url_change ON "Grant";
CREATE TRIGGER trg_re_research_on_url_change
  AFTER UPDATE ON "Grant"
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_re_research_on_url_change();
