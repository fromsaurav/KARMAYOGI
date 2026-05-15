-- Add composite index on (status, scheduledAt) to support efficient polling
-- for delayed jobs: WHERE status = 'PENDING' AND scheduledAt <= NOW()
CREATE INDEX IF NOT EXISTS "jobs_status_scheduledAt_idx" ON "jobs"("status", "scheduledAt");
