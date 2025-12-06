-- Initialize Karmayogi database
-- This script runs when the PostgreSQL container starts for the first time

-- Create additional indexes for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_user_id_created_at ON jobs(user_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_type_status ON jobs(type, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_scheduled_at ON jobs(scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_logs_job_id_timestamp ON job_logs(job_id, timestamp DESC);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at (will be applied after Prisma migration)
-- These will be created by the application after migration

-- Grant necessary permissions
GRANT CONNECT ON DATABASE karmayogi TO karmayogi_user;
GRANT USAGE ON SCHEMA public TO karmayogi_user;
GRANT CREATE ON SCHEMA public TO karmayogi_user;