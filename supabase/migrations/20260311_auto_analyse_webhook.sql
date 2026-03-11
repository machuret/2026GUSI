-- Enable pg_net extension for HTTP requests from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Trigger function: calls the Edge Function on grant insert
CREATE OR REPLACE FUNCTION public.notify_auto_analyse_grant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Fire-and-forget HTTP POST to the Edge Function (no-verify-jwt mode)
  PERFORM net.http_post(
    url := 'https://lciaprvesogbwolaowsj.supabase.co/functions/v1/auto-analyse-grant',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'Grant',
      'schema', 'public',
      'record', row_to_json(NEW)::jsonb
    )
  );

  RETURN NEW;
END;
$$;

-- Create the trigger on the Grant table
DROP TRIGGER IF EXISTS trg_auto_analyse_grant ON "Grant";
CREATE TRIGGER trg_auto_analyse_grant
  AFTER INSERT ON "Grant"
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_auto_analyse_grant();
