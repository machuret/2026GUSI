-- Setup: Database webhook to auto-analyse grants on insert
-- Run this in the Supabase SQL Editor after deploying the Edge Function.
--
-- IMPORTANT: Replace <YOUR_PROJECT_REF> with your actual Supabase project ref.
-- The webhook URL format is: https://<PROJECT_REF>.supabase.co/functions/v1/auto-analyse-grant
--
-- Alternatively, configure this webhook via the Supabase Dashboard:
--   Database → Webhooks → Create → 
--     Table: Grant
--     Events: INSERT
--     Type: Supabase Edge Function
--     Function: auto-analyse-grant

-- Enable the pg_net extension (required for HTTP webhooks)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create a trigger function that calls the Edge Function via pg_net
CREATE OR REPLACE FUNCTION public.notify_auto_analyse_grant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_url TEXT;
  service_key TEXT;
BEGIN
  -- Get the Edge Function URL from vault or hardcode your project ref
  edge_url := 'https://' || current_setting('app.settings.supabase_project_ref', true) || '.supabase.co/functions/v1/auto-analyse-grant';
  service_key := current_setting('app.settings.service_role_key', true);

  -- Fire-and-forget HTTP POST to the Edge Function
  PERFORM net.http_post(
    url := edge_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
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

-- NOTE: You need to set these app settings in your Supabase project:
--   ALTER DATABASE postgres SET app.settings.supabase_project_ref = 'your-project-ref';
--   ALTER DATABASE postgres SET app.settings.service_role_key = 'your-service-role-key';
--
-- OR simply use the Supabase Dashboard webhook UI which handles auth automatically.
