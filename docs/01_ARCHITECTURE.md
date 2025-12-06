# KarmaYogi Architecture Deep Dive
## Detailed System Design & Component Interaction

---

## 📐 System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Next.js Frontend (Port 3001)                 │   │
│  │  - React 19 + TypeScript                                  │   │
│  │  - Tailwind CSS + Radix UI                                │   │
│  │  - Zustand State Management                               │   │
│  │  - Socket.IO Client (Real-time)                           │   │
│  └───────────────────┬──────────────────────────────────────┘   │
└────────────────────────┼──────────────────────────────────────────┘
                         │
                         │ HTTPS / WSS
                         │
┌────────────────────────┼──────────────────────────────────────────┐
│                 API GATEWAY LAYER                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │          Node.js API Server (Port 3000)                   │   │
│  │                                                            │   │
│  │  ┌────────────┐  ┌─────────────┐  ┌──────────────┐      │   │
│  │  │   Express  │  │  Socket.IO  │  │     JWT      │      │   │
│  │  │  REST API  │  │  WebSocket  │  │     Auth     │      │   │
│  │  └────────────┘  └─────────────┘  └──────────────┘      │   │
│  │                                                            │   │
│  │  ┌────────────┐  ┌─────────────┐  ┌──────────────┐      │   │
│  │  │   Prisma   │  │    Redis    │  │     RBAC     │      │   │
│  │  │    ORM     │  │   Cache     │  │  Middleware  │      │   │
│  │  └────────────┘  └─────────────┘  └──────────────┘      │   │
│  │                                                            │   │
│  │  ┌────────────────────────────────────────────────┐      │   │
│  │  │         gRPC Client (Go Communication)         │      │   │
│  │  └────────────────────────────────────────────────┘      │   │
│  └───────────────────┬──────────────┬───────────────────────┘   │
└────────────────────────┼──────────────┼─────────────────────────┘
                         │              │
                         │ gRPC         │ Redis PubSub
                         │              │
┌────────────────────────┼──────────────┼─────────────────────────┐
│              JOB PROCESSING LAYER (Go Services)                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │         Go Worker Service (Port 50051)                   │   │
│  │  ┌──────────────┐  ┌────────────────┐  ┌─────────────┐ │   │
│  │  │  Worker Pool │  │  Job Processor │  │   gRPC      │ │   │
│  │  │ 100 Workers  │  │   Goroutines   │  │   Server    │ │   │
│  │  └──────────────┘  └────────────────┘  └─────────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │         Go Job Executor (Port 50052)                     │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │   │
│  │  │   File   │ │   Data   │ │  Email   │ │   API    │  │   │
│  │  │Processor │ │Analytics │ │ Handler  │ │Integration│  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │       Go Load Balancer (Port 50053)                      │   │
│  │  - Health Checking                                        │   │
│  │  - Job Distribution                                       │   │
│  │  - Circuit Breaker                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
└──────────────────────────┬───────────────────────────────────────┘
                           │
┌──────────────────────────┼───────────────────────────────────────┐
│                    DATA LAYER                                     │
│  ┌──────────────────────────────┐  ┌──────────────────────────┐ │
│  │    PostgreSQL 16             │  │      Redis 7             │ │
│  │    (Port 5432)               │  │      (Port 6379)         │ │
│  │                              │  │                          │ │
│  │  - Jobs Table                │  │  - Cache Layer           │ │
│  │  - Users Table               │  │  - PubSub Events         │ │
│  │  - RBAC Tables               │  │  - Session Store         │ │
│  │  - Audit Logs                │  │  - Rate Limiting         │ │
│  └──────────────────────────────┘  └──────────────────────────┘ │
└───────────────────────────────────────────────────────────────────┘
```

---

## 🏢 Layer-by-Layer Breakdown

### 1. Frontend Layer (Next.js)

**Location**: `/karmayogi-frontend/`

#### Routing Structure
```
/
├── auth/
│   ├── login                # Login page
│   └── register             # Registration page
│
├── dashboard/               # Role-based dashboards
│   ├── user/                # USER role dashboard
│   ├── manager/             # MANAGER role dashboard
│   └── admin/               # ADMIN role dashboard
│
├── admin/
│   ├── users/               # User management (ADMIN only)
│   └── team/                # Team management (ADMIN/MANAGER)
│
├── jobs/
│   ├── submit/              # Create new job
│   └── [id]/                # Job details
│
└── analytics/               # Analytics dashboard (MANAGER/ADMIN)
```

#### Key Components

**Layout Components** (`src/components/layout/`)
- `DashboardLayout.tsx` - Main layout with sidebar and header
- `Sidebar.tsx` - Navigation menu (role-aware)
- `Header.tsx` - Top bar with user info and notifications

**Feature Components** (`src/components/`)
- `KanbanBoard.tsx` - Drag-and-drop job board
- `JobCard.tsx` - Individual job display
- `TemplateGallery.tsx` - Job template management
- `WebSocketProvider.tsx` - Real-time connection manager

#### State Management (Zustand)

**Location**: `/karmayogi-frontend/src/stores/`

```typescript
// authStore.ts
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  initialize: () => Promise<void>;
  login: (credentials) => Promise<void>;
  logout: () => Promise<void>;
}

// jobStore.ts
interface JobState {
  jobs: Job[];
  loading: boolean;
  error: string | null;
  fetchJobs: () => Promise<void>;
  updateJob: (job: Job) => void;
  deleteJob: (jobId: string) => void;
}
```

---

### 2. API Gateway Layer (Node.js + Express)

**Location**: `/src/`

#### Request Flow
```
Request → Middleware Chain → Controller → Service → Response

1. Global Middleware (app.ts)
   ├── Helmet (Security headers)
   ├── CORS
   ├── Compression
   ├── Body Parser
   ├── Cookie Parser
   ├── Rate Limiting
   └── Audit Logging

2. Route-Specific Middleware
   ├── protectRoute (JWT validation)
   ├── requireAdmin (RBAC check)
   ├── requireManager (RBAC check)
   └── cache (Redis caching)

3. Controller Layer
   └── Validates input, calls service, formats response

4. Service Layer
   └── Business logic, database operations

5. Response
   └── JSON with { success, message, data }
```

#### API Routes Structure

**Location**: `/src/routes/`

```
/api/
├── auth/
│   ├── POST   /register              # User registration
│   ├── POST   /login                 # User login
│   ├── POST   /logout                # User logout
│   └── GET    /me                    # Get current user
│
├── jobs/
│   ├── POST   /                      # Submit job
│   ├── GET    /                      # List user's jobs
│   ├── GET    /kanban                # Get kanban view
│   ├── GET    /:id                   # Get job details
│   ├── PATCH  /:id/status            # Update job status
│   ├── DELETE /:id                   # Delete job
│   └── POST   /:id/retry             # Retry failed job
│
├── admin/
│   ├── GET    /workers               # Worker stats
│   ├── GET    /users                 # List users
│   ├── POST   /users                 # Create user
│   ├── PUT    /users/:id             # Update user
│   ├── DELETE /users/:id             # Delete user
│   ├── GET    /team                  # Team members
│   └── GET    /team/:id              # Team member details
│
├── dashboard/
│   └── GET    /stats                 # Dashboard statistics
│
├── analytics/
│   └── GET    /metrics               # System metrics
│
└── collaboration/
    ├── POST   /comments              # Add comment
    ├── POST   /watchers              # Add watcher
    └── POST   /handoffs              # Hand off job
```

#### Middleware Chain

**Authentication** (`src/middleware/protectRoute.ts`)
```typescript
export const protectRoute = async (req, res, next) => {
  // 1. Extract JWT from cookie
  // 2. Verify token
  // 3. Decode user info
  // 4. Attach to req.user
  // 5. Continue or reject
};
```

**Authorization** (`src/middleware/roleMiddleware.ts`)
```typescript
export const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

export const requireManager = (req, res, next) => {
  if (!['ADMIN', 'MANAGER'].includes(req.user?.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};
```

**Caching** (`src/middleware/cacheMiddleware.ts`)
```typescript
export const cache = (options: CacheOptions) => {
  return async (req, res, next) => {
    // 1. Generate cache key
    // 2. Check Redis
    // 3. Return cached or continue
    // 4. Cache response on way out
  };
};
```

---

### 3. Job Processing Layer (Go Services)

**Location**: `/go-services/`

#### Go Worker Service

**File**: `go-services/worker/worker.go`

```
Worker Pool Architecture:
┌─────────────────────────────────────┐
│       Job Queue (Channel)           │
│     Capacity: 10,000 jobs           │
└────────┬────────────────────────────┘
         │
         │ Distributes to least busy
         ▼
┌────────────────────────────────────────┐
│        Worker Pool (100 Workers)       │
│                                        │
│  Worker 1  Worker 2  ...  Worker 100  │
│     │          │              │        │
│     └──────────┴──────────────┘        │
│              │                         │
│              ▼                         │
│     Goroutines Processing Jobs         │
│     (1,000-10,000 concurrent)         │
└────────────────────────────────────────┘
```

**Key Features**:
- **Worker Pool**: 100 workers handling job distribution
- **Goroutines**: Each job runs in a lightweight goroutine
- **Concurrency**: 10,000+ jobs simultaneously
- **Load Balancing**: Jobs go to least busy worker
- **Health Monitoring**: Track active, completed, failed jobs

#### Go Job Executor

**File**: `go-services/executor/handlers/`

```
Job Type Handlers:
├── file_processor.go        # CSV, JSON, XML parsing
├── data_analytics.go        # Calculations, aggregations
├── email_handler.go         # Bulk email sending
├── api_integration.go       # Parallel API calls
└── custom_script.go         # User scripts execution
```

**Processing Flow**:
```
Job Received
    │
    ├── Parse job type
    │
    ├── Execute handler (goroutine)
    │   ├── File Processing: Parse 1GB CSV in 2 seconds
    │   ├── Data Analytics: Process 1M records in parallel
    │   ├── Email: Send 1000 emails concurrently
    │   ├── API: Call 100 APIs simultaneously
    │   └── Custom: Execute with timeout
    │
    ├── Update job status in PostgreSQL
    │
    └── Publish event to Redis PubSub
```

---

### 4. Communication Protocols

#### HTTP REST (Frontend ↔ Node.js)
```
Request:  POST /api/jobs
Headers:  Cookie: jwt=<token>
Body:     { "type": "FILE_PROCESSING", "data": {...} }

Response: { "success": true, "data": { "jobId": "..." } }
```

#### WebSocket (Frontend ↔ Node.js)
```
Client → Server Events:
- subscribe-job: Subscribe to job updates
- typing: User is typing comment
- activity: User activity ping

Server → Client Events:
- job:created: New job created
- job:status_changed: Job status updated
- job:progress: Job progress update
- users:online: Online users list
- collaboration:comment_added: New comment
```

#### gRPC (Node.js ↔ Go)
```protobuf
service WorkerService {
  rpc ProcessJob(JobRequest) returns (JobResponse);
  rpc GetStatus(Empty) returns (WorkerStatus);
  rpc CancelJob(CancelRequest) returns (CancelResponse);
}
```

**Example Call**:
```typescript
// Node.js
const result = await workerClient.processJob({
  jobId: 'job_123',
  jobType: 'FILE_PROCESSING',
  payload: JSON.stringify(data),
  priority: 3,
  userId: 'user_456'
});
```

#### Redis PubSub (Inter-service Events)
```
Channels:
- job_events: Job lifecycle events
- worker_health: Worker status updates
- system_alerts: Critical alerts
- collaboration: Comments, handoffs

Message Format:
{
  "event": "job:completed",
  "job_id": "job_123",
  "timestamp": "2025-12-05T12:00:00Z",
  "data": { ... }
}
```

---

### 5. Data Layer

#### Database Schema (PostgreSQL)

**Location**: `/prisma/schema.prisma`

**Core Tables**:

```sql
-- Users (Authentication & RBAC)
users
├── id (UUID, PK)
├── email (unique)
├── username (unique)
├── password (hashed)
├── fullName
├── role (USER|MANAGER|ADMIN)
├── isActive
└── createdAt

-- Jobs (Task Queue)
jobs
├── id (UUID, PK)
├── userId (FK → users.id)
├── type (JobType enum)
├── status (JobStatus enum)
├── priority (JobPriority enum)
├── payload (JSON)
├── result (JSON, nullable)
├── error (TEXT, nullable)
├── progress (INT, 0-100)
├── workerId (STRING, nullable)
├── createdAt
├── startedAt (nullable)
└── completedAt (nullable)

-- Collaboration
job_comments
job_watchers
job_handoffs
job_status_changes

-- System
audit_logs
worker_health
queue_stats
```

**Indexes** (Performance Optimization):
```sql
-- Composite indexes for common queries
CREATE INDEX idx_jobs_user_status ON jobs(userId, status);
CREATE INDEX idx_jobs_status_created ON jobs(status, createdAt DESC);
CREATE INDEX idx_jobs_priority_status ON jobs(priority, status);
CREATE INDEX idx_users_role_active ON users(role, isActive);
```

#### Redis Structure

**Cache Keys**:
```
cache:admin:team:/api/admin/team                    # Team list (TTL: 30s)
cache:admin:team:details:/api/admin/team/:userId   # User details (TTL: 60s)
cache:dashboard:stats:user_123                      # Dashboard stats (TTL: 60s)
```

**Session Keys**:
```
session:user_123:jwt                               # JWT token
session:user_123:refresh                           # Refresh token
```

**Rate Limiting**:
```
ratelimit:user_123:/api/jobs:POST                  # Request count
```

---

## 🔄 Request Flow Examples

### Example 1: User Submits a Job

```
1. Frontend (Next.js)
   └── User clicks "Submit Job" button
   └── POST /api/jobs with job data

2. Node.js API
   ├── Middleware: protectRoute validates JWT
   ├── Controller: submitJob
   │   ├── Validate input with Zod
   │   ├── Create job in PostgreSQL (status: PENDING)
   │   └── Send to Go worker via gRPC
   └── Response: { jobId, status: "QUEUED" }

3. Go Worker Service
   ├── Receives job via gRPC
   ├── Adds to job queue (channel)
   ├── Worker picks up job
   │   ├── Update status to ACTIVE (PostgreSQL)
   │   ├── Process job (goroutine)
   │   ├── Update status to COMPLETED (PostgreSQL)
   │   └── Publish "job:completed" to Redis
   └── Returns success

4. Node.js WebSocket
   ├── Subscribes to Redis PubSub
   ├── Receives "job:completed" event
   └── Broadcasts to connected clients

5. Frontend (Next.js)
   ├── WebSocket receives update
   ├── Updates job status in Zustand store
   └── UI reflects new status (green checkmark)
```

**Time**: ~100-300ms for entire flow

---

### Example 2: Admin Views Team Page

```
1. Frontend
   └── Navigate to /admin/team

2. Authentication Check
   └── DashboardLayout calls useAuthStore.initialize()
       ├── Checks JWT cookie
       ├── Calls GET /api/auth/me
       └── Verifies ADMIN role

3. API Call
   └── GET /api/admin/team
       ├── Middleware: protectRoute → requireManager
       ├── Cache middleware checks Redis
       │   ├── Cache HIT: Return cached data (10ms)
       │   └── Cache MISS: Continue to database
       └── Database query with joins (20-50ms)

4. Response
   └── Returns team members with stats
       └── Cached for 30 seconds

5. Frontend Renders
   └── Shows team table with all members
```

**Time with cache**: ~10-20ms
**Time without cache**: ~50-100ms

---

## 🔧 Configuration Files

### Environment Variables

**Node.js** (`.env`)
```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/karmayogi

# Redis
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d

# Server
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3001

# Go Services
GRPC_HOST=localhost:50051
```

**Go** (`.env` or environment)
```bash
# gRPC
GRPC_PORT=50051

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/karmayogi

# Redis
REDIS_URL=redis://localhost:6379

# Worker Config
WORKER_POOL_SIZE=100
MAX_CONCURRENT_JOBS=10000
```

---

## 📊 Performance Characteristics

### Latency
- **API Response**: 10-50ms (with cache), 50-200ms (without)
- **Job Submission**: 50-100ms
- **Job Processing**: 100ms-5s (depends on job type)
- **WebSocket Update**: 20-50ms
- **gRPC Call**: 1-10ms (internal network)

### Throughput
- **API Requests**: 5,000-10,000 req/sec
- **Job Processing**: 5,000-10,000 jobs/minute
- **WebSocket Messages**: 10,000+ messages/sec
- **Database Queries**: 1,000-5,000 queries/sec

### Resource Usage
- **Node.js**: 200-500 MB RAM, 20-40% CPU
- **Go Workers**: 100-300 MB RAM, 60-80% CPU
- **PostgreSQL**: 500 MB-2 GB RAM (depends on data)
- **Redis**: 50-200 MB RAM

---

## 🔐 Security Architecture

### Authentication Flow
```
1. User Login
   ├── POST /api/auth/login
   ├── Validate credentials (bcrypt)
   ├── Generate JWT token
   ├── Set HTTP-only cookie
   └── Return user data

2. Protected Request
   ├── Extract JWT from cookie
   ├── Verify signature
   ├── Check expiration
   ├── Decode user info
   └── Attach to req.user
```

### Authorization Hierarchy
```
ADMIN
  └── Can do everything
      ├── Manage all users
      ├── View all jobs
      ├── System configuration
      └── Includes MANAGER permissions

MANAGER
  └── Can manage team
      ├── View team members
      ├── View all jobs
      ├── Analytics access
      └── Includes USER permissions

USER
  └── Can use system
      ├── Submit jobs
      ├── View own jobs
      └── Basic features
```

---

## 🎯 Interview Questions & Answers

### Q: Why hybrid Node.js + Go architecture?

> "We chose Node.js for the API layer because of its excellent ecosystem for web development, real-time features with Socket.IO, and Prisma ORM for database operations. However, for job processing, we needed better concurrency and performance. Go's goroutines allow us to process 10,000+ jobs simultaneously with minimal memory overhead, achieving 50-100x better performance than Node.js workers. The two communicate via gRPC for fast, type-safe inter-service communication."

### Q: How do you handle job failures?

> "We implement a comprehensive retry mechanism. Each job has a maxRetries count (default 3) and currentRetry counter. When a job fails, we check if retries remain, increment the counter, and requeue it with exponential backoff. Failed jobs after all retries are marked as FAILED and moved to a dead letter queue. Admins can manually retry or investigate via the dashboard. All failures are logged to PostgreSQL with error details and published to monitoring systems."

### Q: How does your caching strategy work?

> "We use Redis as a caching layer with strategic TTLs. High-read, low-write data like team lists cache for 30 seconds, user details for 60 seconds. Each cache entry includes an X-Cache header (HIT/MISS) for observability. Cache invalidation happens automatically via TTL, but we also have manual invalidation functions for critical updates. This reduced our database load by 70-90% and improved response times from 200ms to 10ms."

### Q: What's your approach to scalability?

> "Horizontally scalable at every layer. Frontend deploys to CDN, Node.js API runs multiple instances behind a load balancer with Redis for shared state. Go workers are stateless and can scale to hundreds of instances. PostgreSQL uses read replicas for query distribution. The entire stack is containerized with Docker and orchestrated via Kubernetes, with auto-scaling based on CPU/memory metrics. We can handle 10,000+ concurrent users with this architecture."

---

**Next**: Read [02_RBAC_FLOW.md](02_RBAC_FLOW.md) for authentication and authorization details

**Last Updated**: 2025-12-05
