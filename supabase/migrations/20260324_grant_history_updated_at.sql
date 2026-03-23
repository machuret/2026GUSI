-- Auto-update updatedAt on GrantHistory rows whenever they are modified.
-- Uses the same moddatetime extension pattern as other tables in this project.

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "GrantHistory_set_updated_at"
BEFORE UPDATE ON "GrantHistory"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
