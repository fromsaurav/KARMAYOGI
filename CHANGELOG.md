# Changelog

All notable changes to KarmaYogi are documented here.

---

## [Unreleased] — Week of 2026-05-15

### Security

- **W1a** — WebSocket auth now catches `TokenExpiredError` separately and returns structured close code `4001` so clients can distinguish expiry from other auth failures (`src/services/websocket.ts`)
- **R1** — Kanban endpoint (`GET /api/jobs/kanban`) was returning all jobs to every role; regular users now only see their own jobs — `403` for anything else
- **R2** — `GET /api/collaboration/jobs/:jobId/comments` now enforces `assertJobAccess` before returning data
- **R3** — `GET /api/collaboration/jobs/:jobId/watchers` now enforces `assertJobAccess`
- **R4** — `POST /api/collaboration/jobs/:jobId/comments` now enforces `assertJobAccess` before writing
- **R5** — `PUT /api/collaboration/comments/:commentId` now re-validates that the editor still has access to the parent job after the ownership check
- **R6** — `GET /api/collaboration/jobs/:jobId/activity` now enforces `assertJobAccess`
- **R7** — `POST /api/collaboration/jobs/:jobId/handoff` now rejects handoff to an inactive user (`isActive: false`) with `422`

### Performance

- **P1** — `/api/manager/team/members`: replaced per-member `job.count()` loop (N×4 queries) with a single `groupBy(['userId', 'status'])`
- **P2** — `/api/manager/team/workload`: replaced per-member aggregate loop with two batch queries (`groupBy` + `findMany`)
- **P3** — Added composite index `(status, scheduledAt)` to the `jobs` table for efficient delayed-job polling
- **P4** — `getUserStats`: replaced 5 parallel `job.count()` calls with a single `groupBy(['status'])`
- **P6** — `getManagerStats`: replaced `include` with `select` on the recent-team-jobs query to avoid fetching every job column
- **P7** — `GET /api/jobs/kanban` now accepts `?limit` (default 50, max 200) and `?offset` pagination parameters

### Reliability

- **Q1** — `updateJobStatus` controller was calling `updateJobStatus` (service) but not persisting the status change to the database; the call now routes through `updateJobStatusInDB` which writes the `jobStatusChange` record
- **Q2** — Dead-letter Bull queue was hardcoded to `localhost:6379`; it now reads from `config.redis.url` like all other queues
- **W1b** — WebSocket server now sends `server:ping` every 30 s; sockets that do not reply with `client:pong` are disconnected to prevent stale connection accumulation

### Infrastructure

- `src/middleware/jobAccess.ts` — new shared `assertJobAccess(jobId, userId, role)` helper used by all job-scoped endpoints; eliminates duplicated access-control logic
- `prisma/seed.ts` — updated to match current schema (`fullName`, `username` fields; added MANAGER user)
- Dropped unused `redisClient` and `JobType` imports from `queueManager.ts`

### Tests added

16 new test files covering all of the above fixes (113 → 126 passing tests):

| File | Covers |
|------|--------|
| `tests/integration/updateJobStatus.test.ts` | Q1 |
| `tests/integration/kanbanRbac.test.ts` | R1, P7 |
| `tests/integration/teamMembers.test.ts` | P1 |
| `tests/integration/teamWorkload.test.ts` | P2 |
| `tests/integration/collaborationReadAccess.test.ts` | R2, R3, R6 |
| `tests/integration/commentWrite.test.ts` | R4 |
| `tests/integration/commentUpdate.test.ts` | R5 |
| `tests/integration/jobHandoff.test.ts` | R7 |
| `tests/integration/getUserStats.test.ts` | P4 |
| `tests/unit/websocket.test.ts` | W1a, W1b |
| `tests/unit/queueManager.test.ts` | Q2 |
