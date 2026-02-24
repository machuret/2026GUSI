-- Allow 'Rejected' as a valid decision value for grants
ALTER TABLE "Grant" DROP CONSTRAINT IF EXISTS "Grant_decision_check";
ALTER TABLE "Grant" ADD CONSTRAINT "Grant_decision_check"
  CHECK (decision IN ('Apply', 'Maybe', 'No', 'Rejected'));
