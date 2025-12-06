-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('ADMIN', 'USER', 'WORKER');

-- CreateEnum
CREATE TYPE "public"."JobType" AS ENUM ('FILE_PROCESSING', 'DATA_ANALYTICS', 'EMAIL_TASK', 'API_INTEGRATION', 'CUSTOM_SCRIPT');

-- CreateEnum
CREATE TYPE "public"."JobStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'FAILED', 'CANCELLED', 'DELAYED');

-- CreateEnum
CREATE TYPE "public"."JobPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "public"."LogLevel" AS ENUM ('INFO', 'WARN', 'ERROR', 'DEBUG');

-- CreateEnum
CREATE TYPE "public"."WorkerStatus" AS ENUM ('HEALTHY', 'UNHEALTHY', 'IDLE', 'BUSY');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "public"."UserRole" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."jobs" (
    "id" TEXT NOT NULL,
    "type" "public"."JobType" NOT NULL,
    "status" "public"."JobStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "public"."JobPriority" NOT NULL DEFAULT 'MEDIUM',
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "currentRetry" INTEGER NOT NULL DEFAULT 0,
    "delay" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."job_dependencies" (
    "id" TEXT NOT NULL,
    "parentJobId" TEXT NOT NULL,
    "dependentJobId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."job_logs" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "level" "public"."LogLevel" NOT NULL,
    "message" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "job_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_rate_limits" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_rate_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."worker_health" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "status" "public"."WorkerStatus" NOT NULL DEFAULT 'IDLE',
    "lastHeartbeat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedJobs" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "uptime" INTEGER NOT NULL DEFAULT 0,
    "currentJobId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "worker_health_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."queue_stats" (
    "id" TEXT NOT NULL,
    "queueName" TEXT NOT NULL,
    "waiting" INTEGER NOT NULL DEFAULT 0,
    "active" INTEGER NOT NULL DEFAULT 0,
    "completed" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "delayed" INTEGER NOT NULL DEFAULT 0,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "queue_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "jobs_status_idx" ON "public"."jobs"("status");

-- CreateIndex
CREATE INDEX "jobs_priority_idx" ON "public"."jobs"("priority");

-- CreateIndex
CREATE INDEX "jobs_type_idx" ON "public"."jobs"("type");

-- CreateIndex
CREATE INDEX "jobs_userId_idx" ON "public"."jobs"("userId");

-- CreateIndex
CREATE INDEX "jobs_createdAt_idx" ON "public"."jobs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "job_dependencies_parentJobId_dependentJobId_key" ON "public"."job_dependencies"("parentJobId", "dependentJobId");

-- CreateIndex
CREATE INDEX "job_logs_jobId_idx" ON "public"."job_logs"("jobId");

-- CreateIndex
CREATE INDEX "job_logs_timestamp_idx" ON "public"."job_logs"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "user_rate_limits_userId_endpoint_key" ON "public"."user_rate_limits"("userId", "endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "worker_health_workerId_key" ON "public"."worker_health"("workerId");

-- CreateIndex
CREATE INDEX "queue_stats_queueName_idx" ON "public"."queue_stats"("queueName");

-- CreateIndex
CREATE INDEX "queue_stats_timestamp_idx" ON "public"."queue_stats"("timestamp");

-- AddForeignKey
ALTER TABLE "public"."jobs" ADD CONSTRAINT "jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."job_dependencies" ADD CONSTRAINT "job_dependencies_parentJobId_fkey" FOREIGN KEY ("parentJobId") REFERENCES "public"."jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."job_dependencies" ADD CONSTRAINT "job_dependencies_dependentJobId_fkey" FOREIGN KEY ("dependentJobId") REFERENCES "public"."jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."job_logs" ADD CONSTRAINT "job_logs_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "public"."jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_rate_limits" ADD CONSTRAINT "user_rate_limits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
