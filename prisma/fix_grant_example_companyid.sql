-- Fix: GrantExample.companyId was created as UUID but Company.id uses CUID (text).
-- Change the column type to TEXT to match the rest of the schema.
ALTER TABLE "GrantExample" ALTER COLUMN "companyId" TYPE TEXT;
