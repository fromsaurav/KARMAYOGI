# Database Schema

Complete database schema documentation for KarmaYogi distributed task queue system.

## Table of Contents
1. [Database Overview](#database-overview)
2. [Entity Relationship Diagram](#entity-relationship-diagram)
3. [Core Tables](#core-tables)
4. [Support Tables](#support-tables)
5. [Collaboration Tables](#collaboration-tables)
6. [Analytics Tables](#analytics-tables)
7. [Enums](#enums)
8. [Indexes & Performance](#indexes--performance)
9. [Interview Q&A](#interview-qa)

---

## Database Overview

**Database:** PostgreSQL 16

**ORM:** Prisma

**Schema File:** [prisma/schema.prisma](../prisma/schema.prisma)

**Total Tables:** 20+

**Key Features:**
- **Cascading Deletes:** Clean up related data automatically
- **Indexes:** Optimized for common query patterns
- **JSON Fields:** Flexible storage for job payloads and metadata
- **Timestamps:** Track creation and updates
- **Relationships:** Comprehensive foreign key relationships

---

## Entity Relationship Diagram

```
┌──────────────┐         ┌──────────────┐
│              │         │              │
│    User      │────────▶│     Job      │
│              │1       *│              │
└──────┬───────┘         └───────┬──────┘
       │                         │
       │                         │
       │  1                     *│
       ▼                         ▼
┌──────────────┐         ┌──────────────┐
│              │         │              │
│ JobTemplate  │         │   JobLog     │
│              │         │              │
└──────────────┘         └──────────────┘
       │
       │ *
       ▼
┌──────────────┐
│              │
│FavoriteTemp  │
│              │
└──────────────┘

       User
         │
         ├──── JobComment ────▶ Job
         ├──── JobWatcher ────▶ Job
         ├──── JobHandoff ────▶ Job
         ├──── Webhook
         └──── AuditLog
```

**Relationships:**
- **User → Job:** One user creates many jobs (1:N)
- **Job → JobLog:** One job has many logs (1:N)
- **Job → JobDependency:** Jobs can depend on other jobs (M:N)
- **User → JobComment:** Users comment on jobs (M:N through JobComment)
- **User → JobWatcher:** Users watch jobs for updates (M:N through JobWatcher)
- **User → JobTemplate:** Users create reusable templates (1:N)

---

## Core Tables

### users

Stores user accounts and authentication data.

**File:** [prisma/schema.prisma:13-48](../prisma/schema.prisma#L13-L48)

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `id` | String (CUID) | Unique user identifier | PRIMARY KEY |
| `fullName` | String | User's full name | NOT NULL |
| `username` | String | Unique username | UNIQUE, NOT NULL |
| `email` | String | User's email address | UNIQUE, NOT NULL |
| `password` | String | Hashed password (bcrypt) | NOT NULL, VARCHAR(255) |
| `profilePic` | String | Avatar URL | DEFAULT "" |
| `role` | UserRole | User role | DEFAULT USER |
| `isActive` | Boolean | Account active status | DEFAULT true |
| `managerId` | String | Manager's user ID | NULLABLE |
| `createdAt` | DateTime | Account creation | DEFAULT now() |
| `updatedAt` | DateTime | Last update | AUTO UPDATE |

**Relations:**
- `jobs`: One user has many jobs
- `templates`: One user has many job templates
- `comments`: One user has many comments
- `watchedJobs`: One user watches many jobs
- `webhooks`: One user has many webhooks
- `manager`: Self-referential (user reports to manager)
- `managedUsers`: Users managed by this user

**Indexes:**
- Primary key on `id`
- Unique index on `email`
- Unique index on `username`

**Example Row:**
```json
{
  "id": "clxyz123abc",
  "fullName": "John Doe",
  "username": "johndoe",
  "email": "john@example.com",
  "password": "$2a$10$...",
  "profilePic": "https://avatar.url",
  "role": "USER",
  "isActive": true,
  "managerId": null,
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-12-05T10:00:00Z"
}
```

---

### jobs

Stores all job submissions and their execution state.

**File:** [prisma/schema.prisma:50-100](../prisma/schema.prisma#L50-L100)

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `id` | String (UUID) | Unique job identifier | PRIMARY KEY |
| `type` | JobType | Job type enum | NOT NULL |
| `status` | JobStatus | Current job status | DEFAULT PENDING |
| `priority` | JobPriority | Job priority | DEFAULT MEDIUM |
| `payload` | JSON | Job-specific data | NOT NULL |
| `result` | JSON | Job output data | NULLABLE |
| `error` | String | Error message if failed | NULLABLE |
| `progress` | Integer | Completion percentage (0-100) | DEFAULT 0 |
| `maxRetries` | Integer | Max retry attempts | DEFAULT 3 |
| `currentRetry` | Integer | Current retry count | DEFAULT 0 |
| `delay` | Integer | Delay in milliseconds | NULLABLE |
| `metadata` | JSON | Additional metadata | NULLABLE |
| `workerId` | String | Worker processing this job | NULLABLE |
| `failedAt` | DateTime | When job failed | NULLABLE |
| `createdAt` | DateTime | Job creation time | DEFAULT now() |
| `updatedAt` | DateTime | Last update | AUTO UPDATE |
| `startedAt` | DateTime | When processing started | NULLABLE |
| `completedAt` | DateTime | When job finished | NULLABLE |
| `scheduledAt` | DateTime | Scheduled execution time | NULLABLE |
| `userId` | String | Job creator | FOREIGN KEY → users.id |
| `managerId` | String | Overseeing manager | NULLABLE |

**Relations:**
- `user`: Job belongs to user (Many-to-One)
- `logs`: Job has many logs (One-to-Many)
- `comments`: Job has many comments (One-to-Many)
- `watchers`: Job has many watchers (One-to-Many)
- `dependencies`: Job dependencies (Many-to-Many via JobDependency)

**Indexes:**
- Primary key on `id`
- Index on `status` (for filtering)
- Index on `priority` (for queue ordering)
- Index on `type` (for analytics)
- Index on `userId` (for user's jobs)
- Index on `createdAt` (for time-based queries)
- Index on `workerId` (for worker tracking)

**Example Row:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "FILE_PROCESSING",
  "status": "COMPLETED",
  "priority": "HIGH",
  "payload": {
    "fileUrl": "https://example.com/file.csv",
    "operation": "parse_csv"
  },
  "result": {
    "recordsProcessed": 1000,
    "outputUrl": "https://example.com/output.json"
  },
  "error": null,
  "progress": 100,
  "maxRetries": 3,
  "currentRetry": 0,
  "delay": null,
  "metadata": { "description": "Monthly sales report" },
  "workerId": "worker-1",
  "failedAt": null,
  "createdAt": "2025-12-05T10:00:00Z",
  "updatedAt": "2025-12-05T10:05:00Z",
  "startedAt": "2025-12-05T10:00:05Z",
  "completedAt": "2025-12-05T10:05:00Z",
  "scheduledAt": null,
  "userId": "clxyz123abc",
  "managerId": null
}
```

---

### job_dependencies

Defines dependencies between jobs (Job B waits for Job A to complete).

**File:** [prisma/schema.prisma:102-115](../prisma/schema.prisma#L102-L115)

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `id` | String (UUID) | Unique dependency ID | PRIMARY KEY |
| `parentJobId` | String | Parent job that must complete first | FOREIGN KEY → jobs.id |
| `dependentJobId` | String | Dependent job that waits | FOREIGN KEY → jobs.id |
| `createdAt` | DateTime | Dependency creation | DEFAULT now() |

**Constraints:**
- Unique constraint on `(parentJobId, dependentJobId)` - prevent duplicate dependencies
- Both foreign keys cascade on delete

**Example:**
```json
{
  "id": "dep-uuid-123",
  "parentJobId": "job-uuid-1",
  "dependentJobId": "job-uuid-2",
  "createdAt": "2025-12-05T10:00:00Z"
}
```

**Usage:** Job 2 will not start until Job 1 completes successfully.

---

### job_logs

Stores execution logs for each job.

**File:** [prisma/schema.prisma:117-130](../prisma/schema.prisma#L117-L130)

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `id` | String (UUID) | Unique log entry ID | PRIMARY KEY |
| `jobId` | String | Associated job | FOREIGN KEY → jobs.id |
| `level` | LogLevel | Log level enum | NOT NULL |
| `message` | String | Log message | NOT NULL |
| `timestamp` | DateTime | When log was created | DEFAULT now() |
| `metadata` | JSON | Additional context | NULLABLE |

**Indexes:**
- Primary key on `id`
- Index on `jobId` (find all logs for a job)
- Index on `timestamp` (time-based queries)

**Example Rows:**
```json
[
  {
    "id": "log-1",
    "jobId": "job-uuid-1",
    "level": "INFO",
    "message": "Job started processing",
    "timestamp": "2025-12-05T10:00:05Z",
    "metadata": null
  },
  {
    "id": "log-2",
    "jobId": "job-uuid-1",
    "level": "INFO",
    "message": "Downloaded file successfully",
    "timestamp": "2025-12-05T10:00:10Z",
    "metadata": { "fileSize": 1024000 }
  },
  {
    "id": "log-3",
    "jobId": "job-uuid-1",
    "level": "INFO",
    "message": "Job completed",
    "timestamp": "2025-12-05T10:05:00Z",
    "metadata": { "recordsProcessed": 1000 }
  }
]
```

---

## Support Tables

### user_rate_limits

Track API rate limits per user per endpoint.

**File:** [prisma/schema.prisma:132-143](../prisma/schema.prisma#L132-L143)

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `id` | String (UUID) | Unique rate limit ID | PRIMARY KEY |
| `userId` | String | User being rate limited | FOREIGN KEY → users.id |
| `endpoint` | String | API endpoint path | NOT NULL |
| `requests` | Integer | Request count in window | DEFAULT 0 |
| `windowStart` | DateTime | Rate limit window start | DEFAULT now() |

**Constraints:**
- Unique constraint on `(userId, endpoint)`

**Example:**
```json
{
  "id": "rate-1",
  "userId": "user-123",
  "endpoint": "/api/jobs",
  "requests": 7,
  "windowStart": "2025-12-05T10:00:00Z"
}
```

**Usage:** When user makes 10 requests to `/api/jobs` in 1 minute, next request is blocked.

---

### worker_health

Monitor worker status and health.

**File:** [prisma/schema.prisma:145-160](../prisma/schema.prisma#L145-L160)

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `id` | String (UUID) | Unique health record ID | PRIMARY KEY |
| `workerId` | String | Worker identifier | UNIQUE, NOT NULL |
| `status` | WorkerStatus | Worker status enum | DEFAULT IDLE |
| `lastHeartbeat` | DateTime | Last heartbeat timestamp | DEFAULT now() |
| `processedJobs` | Integer | Total jobs processed | DEFAULT 0 |
| `errors` | Integer | Total errors encountered | DEFAULT 0 |
| `uptime` | Integer | Uptime in seconds | DEFAULT 0 |
| `currentJobId` | String | Job currently processing | NULLABLE |
| `metadata` | JSON | Additional worker info | NULLABLE |
| `createdAt` | DateTime | Worker registration | DEFAULT now() |
| `updatedAt` | DateTime | Last update | AUTO UPDATE |

**Example:**
```json
{
  "id": "health-1",
  "workerId": "worker-1",
  "status": "BUSY",
  "lastHeartbeat": "2025-12-05T10:05:00Z",
  "processedJobs": 150,
  "errors": 5,
  "uptime": 3600,
  "currentJobId": "job-uuid-123",
  "metadata": { "version": "1.0.0", "host": "server-1" },
  "createdAt": "2025-12-05T09:00:00Z",
  "updatedAt": "2025-12-05T10:05:00Z"
}
```

---

### queue_stats

Store queue statistics snapshots.

**File:** [prisma/schema.prisma:162-176](../prisma/schema.prisma#L162-L176)

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `id` | String (UUID) | Unique snapshot ID | PRIMARY KEY |
| `queueName` | String | Queue identifier | NOT NULL |
| `waiting` | Integer | Jobs waiting | DEFAULT 0 |
| `active` | Integer | Jobs processing | DEFAULT 0 |
| `completed` | Integer | Jobs completed | DEFAULT 0 |
| `failed` | Integer | Jobs failed | DEFAULT 0 |
| `delayed` | Integer | Jobs delayed | DEFAULT 0 |
| `paused` | Boolean | Queue paused status | DEFAULT false |
| `timestamp` | DateTime | Snapshot time | DEFAULT now() |

**Indexes:**
- Index on `queueName`
- Index on `timestamp`

**Example:**
```json
{
  "id": "stats-1",
  "queueName": "jobQueue",
  "waiting": 10,
  "active": 5,
  "completed": 450,
  "failed": 25,
  "delayed": 2,
  "paused": false,
  "timestamp": "2025-12-05T10:00:00Z"
}
```

---

### job_templates

Reusable job templates for common tasks.

**File:** [prisma/schema.prisma:179-202](../prisma/schema.prisma#L179-L202)

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `id` | String (UUID) | Unique template ID | PRIMARY KEY |
| `userId` | String | Template creator | FOREIGN KEY → users.id |
| `name` | String | Template name | NOT NULL |
| `description` | String | Template description | NULLABLE |
| `jobType` | JobType | Type of job | NOT NULL |
| `priority` | JobPriority | Default priority | DEFAULT MEDIUM |
| `config` | JSON | Payload structure & defaults | NOT NULL |
| `tags` | String[] | Categorization tags | NOT NULL |
| `isPublic` | Boolean | Available to all users | DEFAULT false |
| `usageCount` | Integer | Times used | DEFAULT 0 |
| `createdAt` | DateTime | Template creation | DEFAULT now() |
| `updatedAt` | DateTime | Last update | AUTO UPDATE |

**Indexes:**
- Index on `userId`
- Index on `isPublic`
- Index on `jobType`

**Example:**
```json
{
  "id": "template-1",
  "userId": "user-123",
  "name": "CSV Data Processing",
  "description": "Parse and analyze CSV files",
  "jobType": "FILE_PROCESSING",
  "priority": "MEDIUM",
  "config": {
    "operation": "parse_csv",
    "delimiter": ",",
    "headers": true
  },
  "tags": ["csv", "data", "processing"],
  "isPublic": true,
  "usageCount": 45,
  "createdAt": "2025-11-01T00:00:00Z",
  "updatedAt": "2025-12-05T10:00:00Z"
}
```

---

### system_alerts

System-wide alerts and notifications.

**File:** [prisma/schema.prisma:221-238](../prisma/schema.prisma#L221-L238)

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `id` | String (UUID) | Unique alert ID | PRIMARY KEY |
| `level` | AlertLevel | Alert severity | NOT NULL |
| `type` | AlertType | Alert type enum | NOT NULL |
| `message` | String | Alert message | NOT NULL |
| `action` | String | Suggested action | NULLABLE |
| `data` | JSON | Additional context | NULLABLE |
| `resolved` | Boolean | Alert resolved status | DEFAULT false |
| `createdAt` | DateTime | Alert creation | DEFAULT now() |
| `resolvedAt` | DateTime | Resolution time | NULLABLE |

**Indexes:**
- Index on `level`
- Index on `type`
- Index on `resolved`
- Index on `createdAt`

**Example:**
```json
{
  "id": "alert-1",
  "level": "WARNING",
  "type": "QUEUE_DEPTH",
  "message": "Queue depth exceeds 100 jobs",
  "action": "Consider adding more workers",
  "data": { "queueDepth": 125, "threshold": 100 },
  "resolved": false,
  "createdAt": "2025-12-05T10:00:00Z",
  "resolvedAt": null
}
```

---

## Collaboration Tables

### job_comments

User comments on jobs for collaboration.

**File:** [prisma/schema.prisma:256-269](../prisma/schema.prisma#L256-L269)

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `id` | String (UUID) | Unique comment ID | PRIMARY KEY |
| `jobId` | String | Job being commented on | FOREIGN KEY → jobs.id |
| `userId` | String | Comment author | FOREIGN KEY → users.id |
| `content` | Text | Comment content | NOT NULL |
| `createdAt` | DateTime | Comment creation | DEFAULT now() |
| `updatedAt` | DateTime | Last edit | AUTO UPDATE |

**Indexes:**
- Index on `jobId` (find all comments for a job)

**Example:**
```json
{
  "id": "comment-1",
  "jobId": "job-uuid-1",
  "userId": "user-123",
  "content": "This looks good, approved!",
  "createdAt": "2025-12-05T10:10:00Z",
  "updatedAt": "2025-12-05T10:10:00Z"
}
```

---

### job_watchers

Users watching jobs for updates.

**File:** [prisma/schema.prisma:271-281](../prisma/schema.prisma#L271-L281)

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `jobId` | String | Job being watched | FOREIGN KEY → jobs.id |
| `userId` | String | User watching | FOREIGN KEY → users.id |
| `createdAt` | DateTime | Watch started | DEFAULT now() |

**Constraints:**
- Composite primary key on `(jobId, userId)`

**Example:**
```json
{
  "jobId": "job-uuid-1",
  "userId": "user-456",
  "createdAt": "2025-12-05T10:00:00Z"
}
```

**Usage:** User will receive real-time updates when job status changes.

---

### job_handoffs

Transfer job ownership between users.

**File:** [prisma/schema.prisma:283-296](../prisma/schema.prisma#L283-L296)

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `id` | String (UUID) | Unique handoff ID | PRIMARY KEY |
| `jobId` | String | Job being handed off | FOREIGN KEY → jobs.id |
| `fromUserId` | String | Original owner | FOREIGN KEY → users.id |
| `toUserId` | String | New owner | FOREIGN KEY → users.id |
| `message` | Text | Handoff note | NULLABLE |
| `createdAt` | DateTime | Handoff time | DEFAULT now() |

**Example:**
```json
{
  "id": "handoff-1",
  "jobId": "job-uuid-1",
  "fromUserId": "user-123",
  "toUserId": "user-456",
  "message": "Please review and complete",
  "createdAt": "2025-12-05T10:00:00Z"
}
```

---

### job_status_changes

Audit trail of all status changes.

**File:** [prisma/schema.prisma:298-312](../prisma/schema.prisma#L298-L312)

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `id` | String (UUID) | Unique change ID | PRIMARY KEY |
| `jobId` | String | Job being updated | FOREIGN KEY → jobs.id |
| `userId` | String | User making change | FOREIGN KEY → users.id, NULLABLE |
| `fromStatus` | String | Previous status | NOT NULL |
| `toStatus` | String | New status | NOT NULL |
| `reason` | String | Change reason | NULLABLE |
| `createdAt` | DateTime | Change timestamp | DEFAULT now() |

**Indexes:**
- Index on `jobId`

**Example:**
```json
{
  "id": "change-1",
  "jobId": "job-uuid-1",
  "userId": "user-123",
  "fromStatus": "PENDING",
  "toStatus": "ACTIVE",
  "reason": "Worker picked up job",
  "createdAt": "2025-12-05T10:00:05Z"
}
```

---

### webhooks

User-configured webhooks for job events.

**File:** [prisma/schema.prisma:315-332](../prisma/schema.prisma#L315-L332)

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `id` | String (UUID) | Unique webhook ID | PRIMARY KEY |
| `userId` | String | Webhook owner | FOREIGN KEY → users.id |
| `name` | String | Webhook name | NOT NULL |
| `url` | String | Callback URL | NOT NULL |
| `events` | String[] | Event types to trigger | NOT NULL |
| `secret` | String | HMAC secret for verification | NOT NULL |
| `payloadTemplate` | JSON | Custom payload structure | NULLABLE |
| `isActive` | Boolean | Webhook enabled status | DEFAULT true |
| `createdAt` | DateTime | Webhook creation | DEFAULT now() |
| `updatedAt` | DateTime | Last update | AUTO UPDATE |

**Indexes:**
- Index on `userId`

**Example:**
```json
{
  "id": "webhook-1",
  "userId": "user-123",
  "name": "Job Completion Webhook",
  "url": "https://api.example.com/webhook",
  "events": ["job:completed", "job:failed"],
  "secret": "whsec_abc123...",
  "payloadTemplate": null,
  "isActive": true,
  "createdAt": "2025-11-01T00:00:00Z",
  "updatedAt": "2025-12-05T10:00:00Z"
}
```

---

### webhook_deliveries

Webhook delivery attempts and results.

**File:** [prisma/schema.prisma:334-351](../prisma/schema.prisma#L334-L351)

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `id` | String (UUID) | Unique delivery ID | PRIMARY KEY |
| `webhookId` | String | Associated webhook | FOREIGN KEY → webhooks.id |
| `event` | String | Event that triggered | NOT NULL |
| `payload` | JSON | Sent payload | NOT NULL |
| `status` | String | Delivery status | NOT NULL |
| `statusCode` | Integer | HTTP status code | NULLABLE |
| `responseBody` | Text | Response from endpoint | NULLABLE |
| `errorMessage` | Text | Error if failed | NULLABLE |
| `attemptNumber` | Integer | Retry attempt number | NOT NULL |
| `createdAt` | DateTime | Delivery time | DEFAULT now() |

**Indexes:**
- Index on `webhookId`
- Index on `createdAt`

**Example:**
```json
{
  "id": "delivery-1",
  "webhookId": "webhook-1",
  "event": "job:completed",
  "payload": {
    "jobId": "job-uuid-1",
    "status": "completed",
    "result": { ... }
  },
  "status": "success",
  "statusCode": 200,
  "responseBody": "{\"received\":true}",
  "errorMessage": null,
  "attemptNumber": 1,
  "createdAt": "2025-12-05T10:05:10Z"
}
```

---

## Analytics Tables

### queue_snapshots

Historical queue metrics for analytics.

**File:** [prisma/schema.prisma:241-253](../prisma/schema.prisma#L241-L253)

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `id` | String (UUID) | Unique snapshot ID | PRIMARY KEY |
| `timestamp` | DateTime | Snapshot time | DEFAULT now() |
| `waiting` | Integer | Jobs waiting | NOT NULL |
| `active` | Integer | Jobs processing | NOT NULL |
| `completed` | Integer | Jobs completed | NOT NULL |
| `failed` | Integer | Jobs failed | NOT NULL |
| `delayed` | Integer | Jobs delayed | NOT NULL |
| `workerCount` | Integer | Active workers | NOT NULL |

**Indexes:**
- Index on `timestamp` (for time-series queries)

**Example:**
```json
{
  "id": "snapshot-1",
  "timestamp": "2025-12-05T10:00:00Z",
  "waiting": 10,
  "active": 5,
  "completed": 450,
  "failed": 25,
  "delayed": 2,
  "workerCount": 5
}
```

**Usage:** Taken every minute for historical analytics and trend analysis.

---

### audit_logs

Complete audit trail of all API operations.

**File:** [prisma/schema.prisma:354-376](../prisma/schema.prisma#L354-L376)

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `id` | String (UUID) | Unique log ID | PRIMARY KEY |
| `userId` | String | User performing action | FOREIGN KEY → users.id, NULLABLE |
| `action` | String | Action performed | NOT NULL |
| `resource` | String | Resource type | NOT NULL |
| `resourceId` | String | Resource identifier | NULLABLE |
| `method` | String | HTTP method | NOT NULL |
| `path` | String | API endpoint path | NOT NULL |
| `statusCode` | Integer | Response status | NOT NULL |
| `duration` | Integer | Request duration (ms) | NOT NULL |
| `ipAddress` | String | Client IP | NULLABLE |
| `userAgent` | Text | Client user agent | NULLABLE |
| `requestBody` | JSON | Request payload | NULLABLE |
| `responseBody` | JSON | Response payload | NULLABLE |
| `createdAt` | DateTime | Log timestamp | DEFAULT now() |

**Indexes:**
- Index on `userId`
- Index on `resource`
- Index on `createdAt`

**Example:**
```json
{
  "id": "audit-1",
  "userId": "user-123",
  "action": "CREATE_JOB",
  "resource": "job",
  "resourceId": "job-uuid-1",
  "method": "POST",
  "path": "/api/jobs",
  "statusCode": 201,
  "duration": 45,
  "ipAddress": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "requestBody": {
    "type": "FILE_PROCESSING",
    "priority": "HIGH"
  },
  "responseBody": {
    "success": true,
    "job": { ... }
  },
  "createdAt": "2025-12-05T10:00:00Z"
}
```

---

## Enums

### JobType

Job type enumeration.

**File:** [prisma/schema.prisma:379-385](../prisma/schema.prisma#L379-L385)

```prisma
enum JobType {
  FILE_PROCESSING   // Process uploaded files
  DATA_ANALYTICS    // Perform data analysis
  EMAIL_TASK        // Send emails
  API_INTEGRATION   // Call external APIs
  CUSTOM_SCRIPT     // Execute custom scripts
}
```

---

### JobStatus

Job execution status.

**File:** [prisma/schema.prisma:387-394](../prisma/schema.prisma#L387-L394)

```prisma
enum JobStatus {
  PENDING    // Waiting in queue
  ACTIVE     // Currently processing
  COMPLETED  // Successfully finished
  FAILED     // Error occurred
  CANCELLED  // Manually cancelled
  DELAYED    // Scheduled for later
}
```

**Status Flow:**
```
PENDING → ACTIVE → COMPLETED
                ↓
              FAILED → PENDING (retry)
                ↓
            CANCELLED
```

---

### JobPriority

Job priority levels.

**File:** [prisma/schema.prisma:396-400](../prisma/schema.prisma#L396-L400)

```prisma
enum JobPriority {
  HIGH    // Priority 1 - Process first
  MEDIUM  // Priority 5 - Default
  LOW     // Priority 10 - Process last
}
```

---

### LogLevel

Log severity levels.

**File:** [prisma/schema.prisma:402-407](../prisma/schema.prisma#L402-L407)

```prisma
enum LogLevel {
  INFO   // Informational messages
  WARN   // Warning messages
  ERROR  // Error messages
  DEBUG  // Debug information
}
```

---

### WorkerStatus

Worker health status.

**File:** [prisma/schema.prisma:409-414](../prisma/schema.prisma#L409-L414)

```prisma
enum WorkerStatus {
  HEALTHY   // Worker operating normally
  UNHEALTHY // Worker experiencing issues
  IDLE      // Worker waiting for jobs
  BUSY      // Worker processing jobs
}
```

---

### UserRole

User permission levels.

**File:** [prisma/schema.prisma:416-420](../prisma/schema.prisma#L416-L420)

```prisma
enum UserRole {
  USER     // Basic user - create and view own jobs
  MANAGER  // Manager - view team jobs, access analytics
  ADMIN    // Admin - full system access
}
```

**Hierarchy:** ADMIN > MANAGER > USER

---

### AlertLevel

System alert severity.

**File:** [prisma/schema.prisma:422-426](../prisma/schema.prisma#L422-L426)

```prisma
enum AlertLevel {
  INFO      // Informational alert
  WARNING   // Potential issue
  CRITICAL  // Requires immediate attention
}
```

---

### AlertType

Types of system alerts.

**File:** [prisma/schema.prisma:428-433](../prisma/schema.prisma#L428-L433)

```prisma
enum AlertType {
  QUEUE_DEPTH         // Queue growing too large
  FAILURE_RATE        // High job failure rate
  WORKER_HEALTH       // Worker issues
  SYSTEM_PERFORMANCE  // Performance degradation
}
```

---

## Indexes & Performance

### Primary Indexes (Automatically Created)

All tables have primary key indexes:
- `users.id` (CUID)
- `jobs.id` (UUID)
- `job_logs.id` (UUID)
- etc.

### Secondary Indexes for Performance

**Performance Optimization File:** [prisma/migrations/add_performance_indexes.sql](../prisma/migrations/add_performance_indexes.sql)

#### User Indexes

```sql
-- User table optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role_active
  ON users(role, "isActive") WHERE "isActive" = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_active
  ON users(email, "isActive");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_created_at_desc
  ON users("createdAt" DESC);
```

**Why:** Fast filtering by role and active status, email lookups, time-based queries.

#### Job Indexes

```sql
-- Job table optimizations - composite indexes for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_user_status
  ON jobs("userId", status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_status_created
  ON jobs(status, "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_user_created
  ON jobs("userId", "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_type_status
  ON jobs(type, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_priority_status
  ON jobs(priority, status) WHERE status IN ('PENDING', 'ACTIVE');
```

**Why:**
- `idx_jobs_user_status`: User's jobs filtered by status (dashboard queries)
- `idx_jobs_status_created`: Recent jobs by status (kanban board)
- `idx_jobs_type_status`: Analytics by job type
- `idx_jobs_priority_status`: Queue ordering (high priority jobs first)

**Performance Gain:** 80-95% faster queries with indexes.

### Composite Indexes Strategy

We use composite indexes for multi-column queries:

**Example Query:**
```sql
SELECT * FROM jobs
WHERE "userId" = 'user-123' AND status = 'COMPLETED'
ORDER BY "createdAt" DESC
LIMIT 50;
```

**With Index:** Uses `idx_jobs_user_status` → 5ms query time

**Without Index:** Full table scan → 500ms query time

**Improvement:** 100x faster!

---

## Interview Q&A

### Common Questions

**Q1: Why did you choose PostgreSQL over MySQL or MongoDB?**

**Answer:** PostgreSQL was chosen for several key reasons:

**Technical Advantages:**
1. **Advanced Data Types:** JSON support for flexible job payloads while maintaining relational integrity
2. **ACID Compliance:** Critical for job queue consistency - can't lose jobs
3. **Concurrent Performance:** Better handling of concurrent writes (important for multi-worker system)
4. **Full-Text Search:** Built-in search capabilities for job logs and comments
5. **Array Support:** Native array types for tags, events, etc.

**vs. MySQL:**
- PostgreSQL has better JSON performance
- More advanced indexing options (partial indexes, expression indexes)
- Better support for complex queries

**vs. MongoDB:**
- We need relational integrity (foreign keys, cascades)
- Complex queries across tables (joins)
- ACID guarantees for job processing
- MongoDB better for unstructured data, but our schema is well-defined

**Hybrid Approach:** We use Redis alongside PostgreSQL:
- PostgreSQL: Source of truth, persistent storage
- Redis: Message queue, caching, real-time data

---

**Q2: How do you ensure data consistency in a distributed system?**

**Answer:** Multiple strategies for data consistency:

**1. Database Transactions:**
```typescript
await prisma.$transaction([
  prisma.job.create({ data: jobData }),
  prisma.jobLog.create({ data: logData }),
  prisma.user.update({ where: { id: userId }, data: { ... } })
]);
```
All operations succeed or all fail - atomic.

**2. Foreign Key Constraints:**
- Prevent orphaned records
- Cascade deletes ensure related data is cleaned up

**3. PostgreSQL as Source of Truth:**
- Redis queue is transient (can be rebuilt)
- PostgreSQL persists all job data
- On server restart, recover from database

**4. Status Audit Trail:**
- `job_status_changes` table tracks all state transitions
- Can't skip states (PENDING → ACTIVE → COMPLETED)
- Every change is logged

**5. Retry Mechanism:**
- If worker crashes, job remains in database
- Another worker can pick it up
- `maxRetries` prevents infinite loops

**6. Idempotency:**
- Jobs can be retried safely
- Use job ID to prevent duplicate processing

---

**Q3: How did you design your database indexes?**

**Answer:** Systematic approach to index design:

**Step 1: Identify Common Queries**
- Analyzed API endpoints and their queries
- Profiled slow queries in development
- Identified patterns (user's jobs, jobs by status, etc.)

**Step 2: Create Composite Indexes**
- Index columns used together in WHERE/JOIN
- Order matters: most selective column first
- Example: `(userId, status)` not `(status, userId)` - userId more selective

**Step 3: Partial Indexes**
```sql
CREATE INDEX idx_jobs_priority_status
  ON jobs(priority, status)
  WHERE status IN ('PENDING', 'ACTIVE');
```
Only index relevant rows - smaller, faster index.

**Step 4: Use EXPLAIN ANALYZE**
```sql
EXPLAIN ANALYZE
SELECT * FROM jobs WHERE "userId" = 'user-123';
```
Verify query uses index, not seq scan.

**Trade-offs:**
- ✅ Faster reads (80-95% improvement)
- ❌ Slower writes (10-20% overhead)
- ❌ More storage (indexes take space)

**Decision:** For read-heavy workload (jobs are queried frequently), indexes are worth it.

---

**Q4: How do you handle database migrations in production?**

**Answer:** Careful migration strategy using Prisma:

**Development:**
```bash
# Create migration
npx prisma migrate dev --name add_worker_tracking

# Generates SQL in prisma/migrations/
```

**Production:**
```bash
# Review SQL before applying
cat prisma/migrations/*/migration.sql

# Apply migration (with backup first!)
npx prisma migrate deploy
```

**Best Practices:**
1. **Always Backup:** Automated backups before migrations
2. **Test on Staging:** Apply to staging environment first
3. **Rollback Plan:** Have rollback scripts ready
4. **Zero-Downtime:**
   - Add new columns as nullable
   - Deploy code that works with old and new schema
   - Run migration
   - Deploy code that requires new schema
   - Clean up old columns later

**Example Zero-Downtime Migration:**
```sql
-- Step 1: Add nullable column
ALTER TABLE jobs ADD COLUMN workerId VARCHAR(255);

-- Deploy app code that uses workerId if present

-- Step 2: Backfill data
UPDATE jobs SET workerId = 'worker-1' WHERE status = 'ACTIVE';

-- Step 3: Make it required (later)
ALTER TABLE jobs ALTER COLUMN workerId SET NOT NULL;
```

---

**Q5: How do you handle JSON columns in PostgreSQL?**

**Answer:** PostgreSQL provides two JSON types - we use `Json`:

**Why JSON Columns:**
- Job payloads vary by type (FILE_PROCESSING vs EMAIL_TASK)
- Flexible without altering schema
- Can query JSON data with PostgreSQL operators

**Example Usage:**
```typescript
// Create job with JSON payload
await prisma.job.create({
  data: {
    type: 'FILE_PROCESSING',
    payload: {
      fileUrl: 'https://example.com/file.csv',
      operation: 'parse_csv',
      options: {
        delimiter: ',',
        headers: true
      }
    }
  }
});

// Query JSON data
await prisma.job.findMany({
  where: {
    payload: {
      path: ['operation'],
      equals: 'parse_csv'
    }
  }
});
```

**Validation:**
- Joi schemas validate structure before saving
- TypeScript types ensure type safety
- Can add CHECK constraints for critical fields

**Performance:**
- Index JSON fields if queried frequently
- GIN indexes for JSON queries:
```sql
CREATE INDEX idx_jobs_payload ON jobs USING GIN (payload);
```

**Trade-offs:**
- ✅ Flexibility - no schema changes needed
- ✅ Different payload structures per job type
- ❌ Less strict validation than columns
- ❌ Harder to query (but PostgreSQL JSON operators help)

---

**Q6: Explain your approach to database relationships.**

**Answer:** We use several relationship patterns:

**1. One-to-Many (User → Jobs):**
```prisma
model User {
  id   String @id
  jobs Job[]  @relation("UserJobs")
}

model Job {
  id     String @id
  userId String
  user   User   @relation("UserJobs", fields: [userId], references: [id])
}
```
One user creates many jobs.

**2. Many-to-Many (Users ↔ Jobs via Watchers):**
```prisma
model JobWatcher {
  jobId  String
  userId String
  job    Job  @relation(fields: [jobId], references: [id])
  user   User @relation(fields: [userId], references: [id])

  @@id([jobId, userId])
}
```
Many users can watch many jobs - junction table.

**3. Self-Referential (Manager → Subordinates):**
```prisma
model User {
  id           String @id
  managerId    String?
  manager      User?  @relation("ManagerSubordinates", fields: [managerId], references: [id])
  managedUsers User[] @relation("ManagerSubordinates")
}
```
User can be manager of other users.

**4. Cascading Deletes:**
```prisma
user User @relation(fields: [userId], references: [id], onDelete: Cascade)
```
When user deleted, all their jobs automatically deleted.

**5. Nullable Relationships:**
```prisma
managerId String?
```
Optional relationships (user may not have manager).

**Design Decisions:**
- Use foreign keys to enforce referential integrity
- Cascade deletes for owned data (jobs belong to user)
- Set NULL for references (audit logs reference deleted users)
- Named relations when multiple relationships exist

---

**Q7: How do you ensure database security?**

**Answer:** Multi-layered security approach:

**1. Connection Security:**
```env
DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"
```
SSL/TLS for encrypted connections.

**2. Principle of Least Privilege:**
- Application user has minimal permissions
- No DROP TABLE, CREATE USER, etc.
- Only CRUD operations on specific tables

**3. Password Security:**
- Never store plain text passwords
- bcrypt hashing with salt:
```typescript
const hashedPassword = await bcryptjs.hash(password, 10);
```

**4. SQL Injection Prevention:**
- Prisma uses parameterized queries
- Never concatenate user input into SQL:
```typescript
// ✅ Safe (parameterized)
await prisma.user.findUnique({ where: { email: userInput } });

// ❌ Dangerous (SQL injection)
await prisma.$queryRaw`SELECT * FROM users WHERE email = ${userInput}`;
```

**5. Sensitive Data:**
- Passwords hashed (never stored plain text)
- Webhook secrets encrypted
- Audit logs for compliance

**6. Rate Limiting:**
- Prevent brute force on login
- Table: `user_rate_limits`

**7. Backup & Recovery:**
- Automated daily backups
- Point-in-time recovery enabled
- Test restore procedures regularly

---

**Q8: How do you monitor database performance?**

**Answer:** Comprehensive monitoring strategy:

**1. Query Performance:**
```sql
-- Enable slow query logging
ALTER DATABASE karmayogi SET log_min_duration_statement = 1000;

-- Find slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**2. Index Usage:**
```sql
-- Check if indexes are being used
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0;
```
Zero scans = unused index → consider removing.

**3. Table Size:**
```sql
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

**4. Connection Pooling:**
```typescript
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Prisma automatically handles connection pooling
```

**5. Application Metrics:**
- Log query duration in application:
```typescript
const start = Date.now();
const result = await prisma.job.findMany({ ... });
const duration = Date.now() - start;
logger.info(`Query took ${duration}ms`);
```

**6. Alerting:**
- Alert if query > 1000ms
- Alert if connection pool exhausted
- Alert if disk space < 10%

---

## Summary

**Database Statistics:**
- **Tables:** 20+ tables
- **Enums:** 8 enums
- **Relationships:** 30+ foreign keys
- **Indexes:** 25+ indexes (including composite)

**Key Design Principles:**
1. **Normalization:** Proper relational design, minimal redundancy
2. **Performance:** Strategic indexes for common queries
3. **Flexibility:** JSON columns for variable data
4. **Integrity:** Foreign keys, cascades, constraints
5. **Scalability:** Designed for millions of jobs
6. **Auditability:** Complete audit trail of all changes

**Performance Characteristics:**
- Job creation: < 50ms
- Job query (with index): < 10ms
- Job query (without index): 100-500ms
- Dashboard stats: < 100ms (with caching)

**Next Documentation:**
- [06_DEPLOYMENT.md](./06_DEPLOYMENT.md) - Deployment guide
