-- Performance optimization indexes for KarmaYogi
-- Add composite indexes for common query patterns

-- User table optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role_active ON users(role, "isActive") WHERE "isActive" = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_active ON users(email, "isActive");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_created_at_desc ON users("createdAt" DESC);

-- Job table optimizations - composite indexes for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_user_status ON jobs("userId", status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_status_created ON jobs(status, "createdAt" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_user_created ON jobs("userId", "createdAt" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_type_status ON jobs(type, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_priority_status ON jobs(priority, status) WHERE status IN ('PENDING', 'ACTIVE');

-- JobComment optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_comments_user ON job_comments("userId", "createdAt" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_comments_created ON job_comments("createdAt" DESC);

-- JobWatcher optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_watchers_user ON job_watchers("userId");

-- AuditLog optimizations for compliance queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_created ON audit_logs("userId", "createdAt" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_resource_created ON audit_logs(resource, "createdAt" DESC);

-- WorkerHealth optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_worker_health_status_heartbeat ON worker_health(status, "lastHeartbeat" DESC);

-- Analyze tables to update statistics
ANALYZE users;
ANALYZE jobs;
ANALYZE job_comments;
ANALYZE job_watchers;
ANALYZE audit_logs;
ANALYZE worker_health;
