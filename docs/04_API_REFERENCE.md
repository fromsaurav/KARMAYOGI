# API Reference

Complete REST API documentation for KarmaYogi distributed task queue system.

## Table of Contents
1. [API Overview](#api-overview)
2. [Authentication Endpoints](#authentication-endpoints)
3. [Job Endpoints](#job-endpoints)
4. [Admin Endpoints](#admin-endpoints)
5. [Analytics Endpoints](#analytics-endpoints)
6. [Collaboration Endpoints](#collaboration-endpoints)
7. [Error Responses](#error-responses)
8. [Rate Limiting](#rate-limiting)
9. [Interview Q&A](#interview-qa)

---

## API Overview

**Base URL:** `http://localhost:5000/api`

**Content Type:** `application/json`

**Authentication:** JWT token in HTTP-only cookie

**CORS:** Enabled for `http://localhost:3000` (frontend)

### Common Headers

```
Content-Type: application/json
Cookie: token=<jwt_token>
```

### Standard Response Format

**Success Response:**
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { ... }
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Error description",
  "error": "VALIDATION_ERROR"
}
```

---

## Authentication Endpoints

**Base Path:** `/api/auth`

**File:** [src/routes/authRoutes.ts](../src/routes/authRoutes.ts)

### POST /api/auth/signup

Register a new user account.

**Access:** Public

**Request Body:**
```json
{
  "email": "user@example.com",
  "fullName": "John Doe",
  "username": "johndoe",
  "password": "SecurePassword123"
}
```

**Validation:**
- `email`: Required, valid email format
- `fullName`: Required, 2-50 characters
- `username`: Optional (auto-generated from email if not provided)
- `password`: Required, min 6 characters

**Success Response (201):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "fullName": "John Doe",
    "role": "USER"
  }
}
```

**Error Responses:**
- `400`: Invalid email format or password too short
- `409`: Email or username already exists

**Example:**
```bash
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "fullName": "John Doe",
    "password": "Password123"
  }'
```

---

### POST /api/auth/login

Authenticate and receive JWT token.

**Access:** Public

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "fullName": "John Doe",
    "role": "USER",
    "profilePic": "https://avatar.url"
  }
}
```

**Sets Cookie:**
```
Set-Cookie: token=<jwt_token>; HttpOnly; Secure; SameSite=Strict; Max-Age=604800
```

**Error Responses:**
- `400`: Email or password required
- `401`: Invalid email or password

**Example:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "john@example.com",
    "password": "Password123"
  }'
```

---

### POST /api/auth/logout

Logout and clear authentication token.

**Access:** Authenticated

**Request Body:** None

**Success Response (200):**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

**Clears Cookie:**
```
Set-Cookie: token=; Max-Age=0
```

**Example:**
```bash
curl -X POST http://localhost:5000/api/auth/logout \
  -b cookies.txt
```

---

### GET /api/auth/check

Verify authentication status and get current user.

**Access:** Authenticated

**Request Body:** None

**Success Response (200):**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "fullName": "John Doe",
    "role": "USER",
    "profilePic": "https://avatar.url"
  }
}
```

**Error Responses:**
- `401`: Not authenticated or invalid token

**Example:**
```bash
curl -X GET http://localhost:5000/api/auth/check \
  -b cookies.txt
```

---

### GET /api/auth/check-username

Check if username is available.

**Access:** Public

**Query Parameters:**
- `username` (required): Username to check

**Success Response (200):**
```json
{
  "success": true,
  "available": true
}
```

**Example:**
```bash
curl -X GET "http://localhost:5000/api/auth/check-username?username=johndoe"
```

---

## Job Endpoints

**Base Path:** `/api/jobs`

**File:** [src/routes/jobs.ts](../src/routes/jobs.ts)

### POST /api/jobs

Create a new job.

**Access:** Authenticated (USER, MANAGER, ADMIN)

**Rate Limit:** 10 jobs/minute per user

**Request Body:**
```json
{
  "type": "FILE_PROCESSING",
  "priority": "HIGH",
  "payload": {
    "fileUrl": "https://example.com/file.csv",
    "operation": "parse_csv"
  },
  "maxRetries": 3,
  "delay": 0,
  "metadata": {
    "description": "Process sales data"
  }
}
```

**Validation:**
- `type`: Required, one of: `FILE_PROCESSING`, `DATA_ANALYTICS`, `EMAIL_TASK`, `API_INTEGRATION`, `CUSTOM_SCRIPT`
- `priority`: Optional, one of: `LOW`, `MEDIUM` (default), `HIGH`
- `payload`: Required, object with job-specific data
- `maxRetries`: Optional, 0-10 (default: 3)
- `delay`: Optional, milliseconds (default: 0)

**Success Response (201):**
```json
{
  "success": true,
  "message": "Job created successfully",
  "job": {
    "id": "uuid",
    "type": "FILE_PROCESSING",
    "status": "pending",
    "priority": "HIGH",
    "payload": { ... },
    "createdAt": "2025-12-05T10:00:00Z",
    "userId": "uuid",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "fullName": "John Doe"
    }
  }
}
```

**Error Responses:**
- `400`: Invalid job type or priority
- `401`: Not authenticated
- `429`: Rate limit exceeded

**Example:**
```bash
curl -X POST http://localhost:5000/api/jobs \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "type": "FILE_PROCESSING",
    "priority": "HIGH",
    "payload": {
      "fileUrl": "https://example.com/data.csv",
      "operation": "parse_csv"
    }
  }'
```

**WebSocket Event Emitted:**
```javascript
socket.emit('job:created', {
  job: {
    id: 'uuid',
    type: 'FILE_PROCESSING',
    status: 'pending',
    priority: 'HIGH',
    createdAt: '2025-12-05T10:00:00Z'
  }
});
```

---

### GET /api/jobs

Get all jobs (with filters).

**Access:** Authenticated

**Query Parameters:**
- `status` (optional): `PENDING`, `ACTIVE`, `COMPLETED`, `FAILED`, `CANCELLED`
- `type` (optional): Job type filter
- `limit` (optional): Max results (1-100, default: 50)
- `offset` (optional): Pagination offset (default: 0)
- `sortBy` (optional): `createdAt`, `updatedAt`, `priority` (default: `createdAt`)
- `sortOrder` (optional): `asc`, `desc` (default: `desc`)
- `user` (optional): Filter by user ID (ADMIN/MANAGER only)

**Success Response (200):**
```json
{
  "success": true,
  "jobs": [
    {
      "id": "uuid",
      "type": "FILE_PROCESSING",
      "status": "completed",
      "priority": "HIGH",
      "progress": 100,
      "createdAt": "2025-12-05T10:00:00Z",
      "completedAt": "2025-12-05T10:05:00Z",
      "user": {
        "id": "uuid",
        "email": "user@example.com",
        "fullName": "John Doe"
      }
    }
  ],
  "total": 150,
  "limit": 50,
  "offset": 0
}
```

**Example:**
```bash
# Get completed jobs
curl -X GET "http://localhost:5000/api/jobs?status=COMPLETED&limit=10" \
  -b cookies.txt

# Get high priority jobs
curl -X GET "http://localhost:5000/api/jobs?priority=HIGH" \
  -b cookies.txt
```

---

### GET /api/jobs/kanban

Get jobs organized by status (for Kanban board).

**Access:** Authenticated

**Success Response (200):**
```json
{
  "success": true,
  "jobs": {
    "QUEUED": [
      {
        "id": "uuid",
        "title": "FILE PROCESSING",
        "type": "FILE_PROCESSING",
        "priority": "HIGH",
        "status": "pending",
        "assignees": ["John Doe"],
        "createdAt": "2025-12-05T10:00:00Z",
        "progress": 0,
        "tags": ["FILE", "HIGH"],
        "createdBy": "John Doe"
      }
    ],
    "PROCESSING": [ ... ],
    "COMPLETED": [ ... ],
    "FAILED": [ ... ]
  }
}
```

**File:** [src/controllers/jobController.ts:150-250](../src/controllers/jobController.ts#L150-L250)

**Example:**
```bash
curl -X GET http://localhost:5000/api/jobs/kanban \
  -b cookies.txt
```

---

### GET /api/jobs/dashboard

Get dashboard statistics.

**Access:** Authenticated

**Success Response (200):**
```json
{
  "success": true,
  "stats": {
    "totalJobs": 500,
    "completedJobs": 450,
    "failedJobs": 25,
    "activeJobs": 15,
    "pendingJobs": 10,
    "successRate": 94.7,
    "avgCompletionTime": 120000
  }
}
```

**Example:**
```bash
curl -X GET http://localhost:5000/api/jobs/dashboard \
  -b cookies.txt
```

---

### GET /api/jobs/metrics

Get detailed job metrics.

**Access:** MANAGER, ADMIN

**Success Response (200):**
```json
{
  "success": true,
  "message": "Metrics retrieved successfully",
  "data": {
    "jobsPerHour": 45,
    "avgProcessingTime": 3500,
    "queueDepth": 25,
    "workerUtilization": 75.5
  }
}
```

**Error Responses:**
- `403`: Insufficient permissions (USER role)

**Example:**
```bash
curl -X GET http://localhost:5000/api/jobs/metrics \
  -b cookies.txt
```

---

### GET /api/jobs/:jobId

Get specific job details.

**Access:** Authenticated (own jobs or MANAGER/ADMIN)

**Path Parameters:**
- `jobId`: Job UUID

**Success Response (200):**
```json
{
  "success": true,
  "job": {
    "id": "uuid",
    "type": "FILE_PROCESSING",
    "status": "completed",
    "priority": "HIGH",
    "payload": {
      "fileUrl": "https://example.com/file.csv",
      "operation": "parse_csv"
    },
    "result": {
      "recordsProcessed": 1000,
      "outputUrl": "https://example.com/output.json"
    },
    "progress": 100,
    "attempts": 1,
    "createdAt": "2025-12-05T10:00:00Z",
    "startedAt": "2025-12-05T10:00:05Z",
    "completedAt": "2025-12-05T10:05:00Z",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "fullName": "John Doe"
    }
  }
}
```

**Error Responses:**
- `403`: Not authorized to view this job
- `404`: Job not found

**Example:**
```bash
curl -X GET http://localhost:5000/api/jobs/abc-123-def \
  -b cookies.txt
```

---

### PATCH /api/jobs/:jobId/status

Update job status (ADMIN only or job owner for cancellation).

**Access:** Authenticated

**Path Parameters:**
- `jobId`: Job UUID

**Request Body:**
```json
{
  "status": "cancelled"
}
```

**Valid Status Transitions:**
- Any status → `cancelled` (job owner or ADMIN)
- `failed` → `pending` (for retry, ADMIN only)

**Success Response (200):**
```json
{
  "success": true,
  "message": "Job status updated",
  "job": {
    "id": "uuid",
    "status": "cancelled"
  }
}
```

**Example:**
```bash
curl -X PATCH http://localhost:5000/api/jobs/abc-123-def/status \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"status": "cancelled"}'
```

---

### DELETE /api/jobs/:jobId

Delete a job.

**Access:** ADMIN only

**Path Parameters:**
- `jobId`: Job UUID

**Success Response (200):**
```json
{
  "success": true,
  "message": "Job deleted successfully"
}
```

**Error Responses:**
- `403`: Insufficient permissions (not ADMIN)
- `404`: Job not found

**Example:**
```bash
curl -X DELETE http://localhost:5000/api/jobs/abc-123-def \
  -b cookies.txt
```

---

### POST /api/jobs/:jobId/retry

Retry a failed job.

**Access:** Authenticated (own jobs or MANAGER/ADMIN)

**Path Parameters:**
- `jobId`: Job UUID

**Success Response (200):**
```json
{
  "success": true,
  "message": "Job requeued for retry"
}
```

**Error Responses:**
- `400`: Job is not in failed state
- `403`: Not authorized
- `404`: Job not found

**Example:**
```bash
curl -X POST http://localhost:5000/api/jobs/abc-123-def/retry \
  -b cookies.txt
```

---

### GET /api/jobs/:jobId/logs

Get job execution logs.

**Access:** Authenticated (own jobs or MANAGER/ADMIN)

**Path Parameters:**
- `jobId`: Job UUID

**Success Response (200):**
```json
{
  "success": true,
  "logs": [
    {
      "id": "uuid",
      "timestamp": "2025-12-05T10:00:05Z",
      "level": "info",
      "message": "Job started processing",
      "metadata": {}
    },
    {
      "id": "uuid",
      "timestamp": "2025-12-05T10:00:10Z",
      "level": "info",
      "message": "Downloaded file successfully",
      "metadata": { "fileSize": 1024000 }
    },
    {
      "id": "uuid",
      "timestamp": "2025-12-05T10:05:00Z",
      "level": "info",
      "message": "Job completed",
      "metadata": { "recordsProcessed": 1000 }
    }
  ]
}
```

**Example:**
```bash
curl -X GET http://localhost:5000/api/jobs/abc-123-def/logs \
  -b cookies.txt
```

---

## Admin Endpoints

**Base Path:** `/api/admin`

**File:** [src/routes/admin.ts](../src/routes/admin.ts)

### GET /api/admin/workers

Get worker statistics.

**Access:** MANAGER, ADMIN

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "activeWorkers": 5,
    "totalWorkers": 5,
    "idleWorkers": 0,
    "busyWorkers": 5,
    "queueDepth": {
      "waiting": 10,
      "active": 5,
      "completed": 450,
      "failed": 25
    },
    "workers": [
      {
        "id": "worker-1",
        "status": "active",
        "currentJob": "uuid",
        "jobsProcessed": 150,
        "uptime": 3600000
      }
    ]
  }
}
```

**Example:**
```bash
curl -X GET http://localhost:5000/api/admin/workers \
  -b cookies.txt
```

---

### GET /api/admin/queue/depth

Get queue depth statistics.

**Access:** MANAGER, ADMIN

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "waiting": 10,
    "active": 5,
    "completed": 450,
    "failed": 25,
    "delayed": 2,
    "total": 492
  }
}
```

**Example:**
```bash
curl -X GET http://localhost:5000/api/admin/queue/depth \
  -b cookies.txt
```

---

### POST /api/admin/jobs/retry-failed

Retry all failed jobs.

**Access:** ADMIN only

**Success Response (200):**
```json
{
  "success": true,
  "message": "Retrying 25 failed jobs",
  "data": {
    "count": 25
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:5000/api/admin/jobs/retry-failed \
  -b cookies.txt
```

---

### GET /api/admin/users

Get all users.

**Access:** ADMIN only

**Query Parameters:**
- `role` (optional): Filter by role (USER, MANAGER, ADMIN)
- `search` (optional): Search by name or email
- `limit` (optional): Max results (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "fullName": "John Doe",
      "role": "USER",
      "profilePic": "https://avatar.url",
      "createdAt": "2025-01-01T00:00:00Z",
      "_count": {
        "jobs": 50,
        "comments": 25
      }
    }
  ],
  "meta": {
    "total": 100,
    "limit": 50,
    "offset": 0
  }
}
```

**Example:**
```bash
# Get all users
curl -X GET http://localhost:5000/api/admin/users \
  -b cookies.txt

# Search users
curl -X GET "http://localhost:5000/api/admin/users?search=john&role=USER" \
  -b cookies.txt
```

---

### GET /api/admin/users/:userId

Get user details.

**Access:** ADMIN only

**Path Parameters:**
- `userId`: User UUID

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "fullName": "John Doe",
    "role": "USER",
    "profilePic": "https://avatar.url",
    "createdAt": "2025-01-01T00:00:00Z",
    "_count": {
      "jobs": 50,
      "comments": 25,
      "watchedJobs": 10
    }
  }
}
```

**Example:**
```bash
curl -X GET http://localhost:5000/api/admin/users/abc-123-def \
  -b cookies.txt
```

---

### POST /api/admin/users

Create a new user.

**Access:** ADMIN only

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "fullName": "Jane Smith",
  "username": "janesmith",
  "password": "SecurePassword123",
  "role": "USER"
}
```

**Validation:**
- `email`: Required, valid format, unique
- `fullName`: Required
- `username`: Optional (auto-generated if not provided)
- `password`: Required, min 6 characters
- `role`: Optional, one of: USER (default), MANAGER, ADMIN

**Success Response (201):**
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "id": "uuid",
    "email": "newuser@example.com",
    "fullName": "Jane Smith",
    "role": "USER",
    "createdAt": "2025-12-05T10:00:00Z"
  }
}
```

**Error Responses:**
- `400`: Missing required fields or invalid format
- `409`: Email or username already exists

**Example:**
```bash
curl -X POST http://localhost:5000/api/admin/users \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "email": "jane@example.com",
    "fullName": "Jane Smith",
    "password": "Password123",
    "role": "MANAGER"
  }'
```

---

### PUT /api/admin/users/:userId

Update user details.

**Access:** ADMIN only

**Path Parameters:**
- `userId`: User UUID

**Request Body:**
```json
{
  "email": "newemail@example.com",
  "fullName": "Jane Doe",
  "role": "MANAGER",
  "password": "NewPassword123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "User updated successfully",
  "data": {
    "id": "uuid",
    "email": "newemail@example.com",
    "fullName": "Jane Doe",
    "role": "MANAGER",
    "createdAt": "2025-01-01T00:00:00Z"
  }
}
```

**Error Responses:**
- `404`: User not found
- `409`: Email or username already in use

**Example:**
```bash
curl -X PUT http://localhost:5000/api/admin/users/abc-123-def \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "role": "MANAGER"
  }'
```

---

### DELETE /api/admin/users/:userId

Delete a user.

**Access:** ADMIN only

**Path Parameters:**
- `userId`: User UUID

**Success Response (200):**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

**Error Responses:**
- `400`: Cannot delete own account
- `404`: User not found

**Example:**
```bash
curl -X DELETE http://localhost:5000/api/admin/users/abc-123-def \
  -b cookies.txt
```

---

### GET /api/admin/team

Get team members with statistics.

**Access:** MANAGER, ADMIN

**Query Parameters:**
- `role` (optional): Filter by role

**Cache:** 30 seconds

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "fullName": "John Doe",
      "role": "USER",
      "profilePic": "https://avatar.url",
      "createdAt": "2025-01-01T00:00:00Z",
      "stats": {
        "totalJobs": 50,
        "activeJobs": 5,
        "completedJobs": 40,
        "failedJobs": 5,
        "totalComments": 25
      },
      "recentJobs": [
        {
          "id": "uuid",
          "status": "completed",
          "createdAt": "2025-12-05T10:00:00Z"
        }
      ]
    }
  ]
}
```

**Example:**
```bash
curl -X GET http://localhost:5000/api/admin/team \
  -b cookies.txt
```

---

### GET /api/admin/team/:userId

Get team member details.

**Access:** MANAGER, ADMIN

**Path Parameters:**
- `userId`: User UUID

**Cache:** 60 seconds

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "fullName": "John Doe",
    "role": "USER",
    "profilePic": "https://avatar.url",
    "createdAt": "2025-01-01T00:00:00Z",
    "jobs": [
      {
        "id": "uuid",
        "type": "FILE_PROCESSING",
        "status": "completed",
        "priority": "HIGH",
        "createdAt": "2025-12-05T10:00:00Z",
        "completedAt": "2025-12-05T10:05:00Z"
      }
    ],
    "comments": [
      {
        "id": "uuid",
        "content": "This looks good!",
        "createdAt": "2025-12-05T10:10:00Z",
        "job": {
          "id": "uuid",
          "type": "FILE_PROCESSING"
        }
      }
    ],
    "_count": {
      "jobs": 50,
      "comments": 25,
      "watchedJobs": 10
    }
  }
}
```

**Example:**
```bash
curl -X GET http://localhost:5000/api/admin/team/abc-123-def \
  -b cookies.txt
```

---

## Analytics Endpoints

**Base Path:** `/api/analytics`

**File:** [src/routes/analytics.ts](../src/routes/analytics.ts)

### GET /api/analytics/data

Get comprehensive analytics data.

**Access:** MANAGER, ADMIN

**Success Response (200):**
```json
{
  "success": true,
  "message": "Analytics data retrieved successfully",
  "data": {
    "performanceMetrics": {
      "avgResponseTime": 250,
      "throughput": 85,
      "errorRate": 2.5,
      "successRate": 97.5
    },
    "jobStatistics": {
      "totalJobs": 7500,
      "completedJobs": 7000,
      "failedJobs": 300,
      "activeJobs": 50,
      "pendingJobs": 150
    },
    "timeSeriesData": [
      {
        "timestamp": "00:00",
        "jobs": 45,
        "responseTime": 200,
        "errors": 2
      },
      {
        "timestamp": "01:00",
        "jobs": 52,
        "responseTime": 210,
        "errors": 1
      }
    ],
    "jobTypeDistribution": [
      {
        "type": "FILE_PROCESSING",
        "count": 2500,
        "percentage": 33
      },
      {
        "type": "DATA_ANALYTICS",
        "count": 1800,
        "percentage": 24
      }
    ],
    "workerUtilization": [
      {
        "workerId": "Worker-1",
        "utilization": 85,
        "jobsProcessed": 1500
      }
    ]
  }
}
```

**Example:**
```bash
curl -X GET http://localhost:5000/api/analytics/data \
  -b cookies.txt
```

---

### GET /api/analytics/performance

Get performance metrics.

**Access:** Authenticated

**Success Response (200):**
```json
{
  "success": true,
  "message": "Performance metrics retrieved successfully",
  "data": {
    "responseTime": {
      "avg": 250,
      "p95": 450,
      "p99": 850
    },
    "throughput": {
      "current": 85,
      "peak": 220
    },
    "errorRate": 2.5,
    "uptime": 99.7
  }
}
```

**Example:**
```bash
curl -X GET http://localhost:5000/api/analytics/performance \
  -b cookies.txt
```

---

### GET /api/analytics/workers

Get worker analytics.

**Access:** ADMIN only

**Success Response (200):**
```json
{
  "success": true,
  "message": "Worker analytics retrieved successfully",
  "data": {
    "workers": [
      {
        "id": "worker-1",
        "name": "Worker 1",
        "status": "active",
        "jobsProcessed": 1500,
        "avgProcessingTime": 3500,
        "errors": 5,
        "lastActive": "2025-12-05T10:30:00Z"
      }
    ],
    "summary": {
      "total": 10,
      "active": 8,
      "idle": 2,
      "totalJobsProcessed": 12500
    }
  }
}
```

**Example:**
```bash
curl -X GET http://localhost:5000/api/analytics/workers \
  -b cookies.txt
```

---

## Collaboration Endpoints

**Base Path:** `/api/collaboration`

**File:** [src/routes/collaboration.ts](../src/routes/collaboration.ts)

### POST /api/collaboration/jobs/:jobId/comments

Add comment to a job.

**Access:** Authenticated

**Path Parameters:**
- `jobId`: Job UUID

**Request Body:**
```json
{
  "content": "This needs more attention"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Comment added successfully",
  "comment": {
    "id": "uuid",
    "content": "This needs more attention",
    "createdAt": "2025-12-05T10:00:00Z",
    "user": {
      "id": "uuid",
      "fullName": "John Doe",
      "profilePic": "https://avatar.url"
    }
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:5000/api/collaboration/jobs/abc-123-def/comments \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"content": "Looks good!"}'
```

---

### GET /api/collaboration/jobs/:jobId/comments

Get job comments.

**Access:** Authenticated

**Path Parameters:**
- `jobId`: Job UUID

**Success Response (200):**
```json
{
  "success": true,
  "comments": [
    {
      "id": "uuid",
      "content": "This needs more attention",
      "createdAt": "2025-12-05T10:00:00Z",
      "user": {
        "id": "uuid",
        "fullName": "John Doe",
        "profilePic": "https://avatar.url"
      }
    }
  ]
}
```

**Example:**
```bash
curl -X GET http://localhost:5000/api/collaboration/jobs/abc-123-def/comments \
  -b cookies.txt
```

---

## Error Responses

### Standard Error Format

All error responses follow this format:

```json
{
  "success": false,
  "message": "Human-readable error message",
  "error": "ERROR_CODE"
}
```

### Common HTTP Status Codes

| Code | Meaning | When Used |
|------|---------|-----------|
| **200** | OK | Successful request |
| **201** | Created | Resource created successfully |
| **400** | Bad Request | Invalid request data or validation failed |
| **401** | Unauthorized | Not authenticated or invalid token |
| **403** | Forbidden | Authenticated but insufficient permissions |
| **404** | Not Found | Resource doesn't exist |
| **409** | Conflict | Resource already exists (duplicate) |
| **429** | Too Many Requests | Rate limit exceeded |
| **500** | Internal Server Error | Server error |
| **503** | Service Unavailable | Service temporarily unavailable |

### Common Error Codes

| Error Code | Description | Example |
|------------|-------------|---------|
| `VALIDATION_ERROR` | Request data validation failed | Missing required field |
| `AUTHENTICATION_ERROR` | Authentication failed | Invalid credentials |
| `AUTHORIZATION_ERROR` | Insufficient permissions | USER trying to access ADMIN endpoint |
| `NOT_FOUND` | Resource not found | Job ID doesn't exist |
| `DUPLICATE_ERROR` | Resource already exists | Email already registered |
| `RATE_LIMIT_EXCEEDED` | Too many requests | Exceeded 10 jobs/minute |
| `SERVER_ERROR` | Internal server error | Database connection failed |

### Error Response Examples

**400 Bad Request:**
```json
{
  "success": false,
  "message": "Invalid job type. Must be one of: FILE_PROCESSING, DATA_ANALYTICS, EMAIL_TASK, API_INTEGRATION, CUSTOM_SCRIPT",
  "error": "VALIDATION_ERROR"
}
```

**401 Unauthorized:**
```json
{
  "success": false,
  "message": "Authentication required. Please log in.",
  "error": "AUTHENTICATION_ERROR"
}
```

**403 Forbidden:**
```json
{
  "success": false,
  "message": "Insufficient permissions. This endpoint requires ADMIN role.",
  "error": "AUTHORIZATION_ERROR"
}
```

**404 Not Found:**
```json
{
  "success": false,
  "message": "Job not found with ID: abc-123-def",
  "error": "NOT_FOUND"
}
```

**429 Rate Limit:**
```json
{
  "success": false,
  "message": "Rate limit exceeded. Maximum 10 jobs per minute.",
  "error": "RATE_LIMIT_EXCEEDED"
}
```

---

## Rate Limiting

### User Rate Limits

**File:** [src/middleware/rateLimiter.ts](../src/middleware/rateLimiter.ts)

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /api/jobs` | 10 requests | 1 minute |
| `POST /api/auth/login` | 5 requests | 5 minutes |
| `POST /api/auth/signup` | 3 requests | 15 minutes |
| All other endpoints | 100 requests | 1 minute |

### Rate Limit Headers

When rate limit is active, responses include:

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1733400000
```

### Rate Limit Exceeded Response

```json
{
  "success": false,
  "message": "Rate limit exceeded. Maximum 10 jobs per minute.",
  "error": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 45
}
```

---

## Interview Q&A

### Common Questions

**Q1: How did you design the API structure?**

**Answer:** I followed RESTful API design principles with clear resource-based routing:

1. **Resource Organization:** Grouped endpoints by resource (auth, jobs, admin, analytics)
2. **HTTP Methods:** Used semantic methods (GET for read, POST for create, PUT/PATCH for update, DELETE for delete)
3. **Status Codes:** Proper HTTP status codes for different scenarios
4. **Consistent Response Format:** All responses follow `{success, message, data}` structure
5. **Error Handling:** Standardized error responses with error codes

**Key design decisions:**
- `/api/jobs` - All job operations
- `/api/admin` - Admin-only operations
- `/api/analytics` - Analytics and metrics
- Clear separation of concerns

**File:** [src/routes/](../src/routes/)

---

**Q2: How do you handle authentication and authorization?**

**Answer:** We use a layered approach with JWT tokens and middleware:

**Authentication (Who are you?):**
1. User logs in with email/password
2. Server validates credentials and generates JWT token
3. JWT stored in HTTP-only cookie (secure, can't be accessed by JavaScript)
4. Every request includes cookie, verified by `protectRoute` middleware

**Authorization (What can you do?):**
1. After authentication, check user role
2. Role-specific middleware: `requireUser`, `requireManager`, `requireAdmin`
3. Hierarchical permissions: ADMIN > MANAGER > USER

**Code flow:**
```typescript
router.post('/jobs',
  protectRoute,      // Verify JWT token
  requireUser,       // Check role (USER or higher)
  rateLimitUser,     // Apply rate limiting
  submitJob          // Process request
);
```

**Security features:**
- HTTP-only cookies (prevent XSS)
- Secure flag (HTTPS only in production)
- SameSite=Strict (prevent CSRF)
- 7-day expiration

**Files:**
- Authentication: [src/middleware/protectRoute.ts](../src/middleware/protectRoute.ts)
- Authorization: [src/middleware/roleMiddleware.ts](../src/middleware/roleMiddleware.ts)

---

**Q3: How do you implement rate limiting?**

**Answer:** We use Redis-based rate limiting with per-user limits:

**Implementation:**
```typescript
// Rate limit: 10 jobs per minute per user
export const rateLimitUser = async (req, res, next) => {
  const userId = req.user.userId;
  const key = `ratelimit:jobs:${userId}`;

  // Increment counter in Redis
  const count = await redis.incr(key);

  // Set expiry on first request (1 minute window)
  if (count === 1) {
    await redis.expire(key, 60);
  }

  // Check limit
  if (count > 10) {
    return res.status(429).json({
      success: false,
      message: 'Rate limit exceeded. Maximum 10 jobs per minute.'
    });
  }

  next();
};
```

**Why Redis?**
- Fast in-memory storage
- Atomic operations (incr is thread-safe)
- Automatic expiration with TTL
- Distributed rate limiting (works across multiple servers)

**Different limits for different endpoints:**
- Job creation: 10/minute (resource-intensive)
- Login: 5/5 minutes (prevent brute force)
- Signup: 3/15 minutes (prevent spam)
- General API: 100/minute (generous for normal usage)

**File:** [src/middleware/rateLimiter.ts](../src/middleware/rateLimiter.ts)

---

**Q4: How do you handle API versioning?**

**Answer:** Currently we use a single version with backward compatibility:

**Current approach:**
- Base path: `/api` (implicit v1)
- Add optional fields instead of breaking changes
- Maintain backward compatibility

**Future versioning strategy:**
- URL-based versioning: `/api/v1`, `/api/v2`
- Header-based versioning: `Accept: application/vnd.karmayogi.v2+json`

**Migration strategy:**
1. Introduce `/api/v2` with breaking changes
2. Maintain `/api/v1` for 6 months (deprecation period)
3. Add deprecation warnings in v1 responses
4. Eventually sunset v1 after migration period

**Example deprecation response:**
```json
{
  "success": true,
  "data": { ... },
  "deprecated": {
    "message": "This endpoint is deprecated. Use /api/v2/jobs instead.",
    "sunsetDate": "2026-06-01"
  }
}
```

---

**Q5: How do you document your API?**

**Answer:** Multi-layered documentation approach:

1. **This Documentation:** Comprehensive markdown docs with examples
2. **Code Comments:** JSDoc comments in route files
3. **Joi Schemas:** Self-documenting validation schemas
4. **TypeScript Types:** Strong typing for request/response objects

**Future improvements:**
- OpenAPI/Swagger specification
- Interactive API explorer (Swagger UI)
- Postman collection
- API playground

**Example Joi schema (self-documenting):**
```typescript
const submitJobSchema = Joi.object({
  type: Joi.string()
    .valid('FILE_PROCESSING', 'DATA_ANALYTICS', 'EMAIL_TASK', 'API_INTEGRATION', 'CUSTOM_SCRIPT')
    .required()
    .description('Type of job to process'),
  priority: Joi.string()
    .valid('HIGH', 'MEDIUM', 'LOW')
    .optional()
    .default('MEDIUM')
    .description('Job priority'),
  payload: Joi.object()
    .required()
    .description('Job-specific data')
});
```

---

**Q6: How do you handle CORS?**

**Answer:** We configure CORS to allow frontend access while maintaining security:

**Configuration:**
```typescript
app.use(cors({
  origin: 'http://localhost:3000',  // Frontend URL
  credentials: true,                 // Allow cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400  // Cache preflight for 24 hours
}));
```

**Security considerations:**
- Whitelist specific origin (not wildcard `*`)
- `credentials: true` allows cookies
- Only allow necessary methods
- Cache preflight requests to reduce overhead

**Production:**
- Multiple allowed origins for different environments
- Environment-based configuration
- Strict origin validation

**File:** [src/app.ts](../src/app.ts)

---

**Q7: How do you ensure API performance?**

**Answer:** Multiple optimization layers:

**1. Caching (70-90% reduction in DB load):**
```typescript
router.get('/team',
  protectRoute,
  requireManager,
  cache({ ttl: 30, keyPrefix: 'admin:team' }),  // Cache for 30 seconds
  getTeamMembers
);
```

**2. Database Optimization:**
- Composite indexes for common queries
- Select only needed fields
- Pagination on all list endpoints
- Connection pooling

**3. Response Compression:**
- gzip compression for all responses
- 60-70% smaller payload size

**4. Rate Limiting:**
- Prevent abuse and overload
- Redis-based for distributed systems

**5. Async Operations:**
- All database operations are async
- Non-blocking I/O

**Performance metrics:**
- API response time: 50-200ms (without cache)
- API response time: <10ms (with cache hit)
- Throughput: 100+ requests/second per instance

**Files:**
- Caching: [src/middleware/cacheMiddleware.ts](../src/middleware/cacheMiddleware.ts)
- Compression: [src/app.ts](../src/app.ts)

---

**Q8: How do you handle API errors gracefully?**

**Answer:** Comprehensive error handling strategy:

**1. Global Error Handler:**
```typescript
app.use((err, req, res, next) => {
  logger.error('API Error:', err);

  // Don't leak internal errors
  const message = err.statusCode < 500
    ? err.message
    : 'Internal server error';

  res.status(err.statusCode || 500).json({
    success: false,
    message,
    error: err.code || 'SERVER_ERROR'
  });
});
```

**2. Controller-level Error Handling:**
```typescript
export async function getJob(req, res) {
  try {
    const job = await prisma.job.findUnique({ ... });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
        error: 'NOT_FOUND'
      });
    }

    res.json({ success: true, job });
  } catch (error) {
    logger.error('Get job error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get job'
    });
  }
}
```

**3. Validation Errors:**
- Joi validates requests before reaching controllers
- Clear validation error messages
- Field-specific errors

**4. Logging:**
- All errors logged with Winston
- Includes request context (user ID, endpoint, etc.)
- Different log levels (error, warn, info, debug)

**5. User-friendly Messages:**
- Never expose internal errors to users
- Clear, actionable error messages
- Error codes for programmatic handling

---

## Summary

**Key API Features:**
1. **RESTful Design:** Resource-based URLs, semantic HTTP methods
2. **JWT Authentication:** Secure, stateless authentication
3. **Role-Based Authorization:** Hierarchical permissions (USER → MANAGER → ADMIN)
4. **Rate Limiting:** Redis-based per-user limits
5. **Caching:** Redis caching for 70-90% reduction in DB load
6. **Compression:** gzip compression for smaller payloads
7. **Error Handling:** Comprehensive error handling with clear messages
8. **Validation:** Joi schemas for request validation
9. **Performance:** 50-200ms response times, 100+ requests/second

**Total Endpoints:** 35+

**Documentation Files:**
- [00_PROJECT_OVERVIEW.md](./00_PROJECT_OVERVIEW.md) - Project overview
- [01_ARCHITECTURE.md](./01_ARCHITECTURE.md) - System architecture
- [02_RBAC_FLOW.md](./02_RBAC_FLOW.md) - Authentication & authorization
- [03_JOB_WORKFLOW.md](./03_JOB_WORKFLOW.md) - Job processing flow
- [04_API_REFERENCE.md](./04_API_REFERENCE.md) - This document
- [05_DATABASE_SCHEMA.md](./05_DATABASE_SCHEMA.md) - Coming next
- [06_DEPLOYMENT.md](./06_DEPLOYMENT.md) - Coming next
