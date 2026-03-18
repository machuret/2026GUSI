-- Update Grant.crmStatus check constraint to include Built and Improved stages
ALTER TABLE "Grant" DROP CONSTRAINT IF EXISTS "Grant_crmStatus_check";

ALTER TABLE "Grant" ADD CONSTRAINT "Grant_crmStatus_check"
  CHECK ("crmStatus" = ANY (ARRAY['Researching','Pipeline','Active','Built','Improved','Submitted','Won','Lost']));
