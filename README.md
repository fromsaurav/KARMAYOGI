# KarmaYogi - Distributed Job Queue System

A production-grade distributed task queue system with real-time monitoring, role-based access control, and high-performance Go workers.

## 🚀 Live Demo

**Coming soon — Deployment in progress**

---

## ✨ Key Features

### 🎯 Task Queue Management

* **Kanban-style Interface** — Drag-and-drop job management with real-time updates
* **Priority Queues** — HIGH, MEDIUM, LOW priority job processing
* **Job Dependencies** — Chain jobs and orchestrate parallel flows
* **Real-time Progress** — Live job status and progress tracking
* **Kanban Pagination** — `GET /api/jobs/kanban?limit=50&offset=0` (default 50, max 200)

### 👥 Role-Based Access Control

* **User** — Submit and track personal tasks using templates
* **Manager** — Team oversight, workload balancing, job assignment
* **Admin** — System-wide control, worker scaling, analytics

#### Job Access Rules

Access to job data (comments, watchers, activity feed, kanban board, status updates) is enforced consistently across all API endpoints:

| Role | Scope |
|------|-------|
| **USER** | Own jobs only — requests for another user's job return `403` |
| **MANAGER** | Own jobs plus jobs owned by direct reports (`user.managerId`) |
| **ADMIN** | Unrestricted — all jobs in the system |

These rules are implemented in `src/middleware/jobAccess.ts` via the `assertJobAccess(jobId, userId, role)` helper, which is called at the top of every read and write endpoint that is scoped to a specific job.

### ⚡ High-Performance Workers

* **Go-powered Processing** — Concurrent job execution with gRPC
* **Auto-scaling** — Dynamic worker pool (1–10 workers)
* **Smart Retry Logic** — Exponential backoff for failed jobs
* **Worker Health Monitoring** — Real-time performance metrics

### 📊 Advanced Analytics

* **Predictive Analytics** — Queue depth forecasting
* **Bottleneck Detection** — Identify slow workers & problematic job types
* **Performance Trends** — 30‑day job volume & completion analysis
* **Real-time Dashboards** — Live metrics and system health

### 🔔 Collaboration & Alerts

* Job Comments with **@mentions**
* **Watchers** — Subscribe to job updates
* **Job Handoffs** — Transfer ownership
* **Smart Alerts** — Queue depth, failure rate, worker issues

### 🔐 Enterprise Security

* **JWT Authentication** — HTTP-only cookies with explicit expiry validation on every WebSocket connection
* **Audit Logs** — Full compliance trail
* **WebSocket Security** — Role-based broadcast rooms; connections authenticated via `authenticateSocket` middleware that returns close code `4001` on expired tokens
* **WebSocket Heartbeat** — Server sends `server:ping` every 30 s; sockets that do not reply with `client:pong` are terminated automatically to prevent stale connection accumulation
* **User Presence** — Real-time online tracking

---

## 🛠️ Technology Stack

### **Frontend**

* Next.js 15
* TypeScript
* TailwindCSS
* Socket.IO Client

### **Backend**

* Node.js + Express
* Go (Golang)
* gRPC
* PostgreSQL + Prisma ORM
* Redis + Bull Queue
* Socket.IO

### **DevOps**

* Docker Compose
* Prisma
* Protocol Buffers

---

## 🚀 Quick Start

### **Prerequisites**

* Node.js 18+
* Go 1.21+
* Docker & Docker Compose
* PostgreSQL 16+
* Redis 7+

### **1️⃣ Clone Repository**

```bash
git clone https://github.com/fromsaurav/KARMAYOGI.git
cd KARMAYOGI
```

### **2️⃣ Environment Setup**

Create `.env` files:

#### **Root .env:**

```env
DATABASE_URL="postgresql://karmayogi:karmayogi123@localhost:5432/karmayogi"
REDIS_URL="redis://localhost:6379"
JWT_SECRET=your-secret-key
FRONTEND_URL=http://localhost:3000
```

#### **Frontend .env.local:**

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_WS_URL=http://localhost:3000
```

### **3️⃣ Install Dependencies**

```bash
npm install
```

### **4️⃣ Start Infrastructure (Docker)**

```bash
docker-compose up -d postgres redis
```

### **5️⃣ Database Setup**

```bash
npx prisma db push
```

### **6️⃣ Start Go Workers**

```bash
cd go-services/worker
./run-dev.sh

cd ../executor
./run-dev.sh
```

### **7️⃣ Start Node.js Application**

```bash
npm run dev
```

### **8️⃣ Access Application**

* **Frontend:** [http://localhost:3000](http://localhost:3000)
* **Backend API:** [http://localhost:3000/api](http://localhost:3000/api)
* **WebSocket:** Auto-connects via frontend

---

## 📁 Project Structure

```
KarmaYogi/
├── backend/                 # Node.js Express API
│   ├── src/
│   │   ├── controllers/     # API endpoints
│   │   ├── routes/          # Route definitions
│   │   ├── services/        # Business logic
│   │   └── middleware/      # Auth, audit logging
│   └── prisma/              # Database schema
│
├── frontend/                # Next.js 15 application
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   └── hooks/
│   └── public/
│
├── go-services/            # Go workers
│   ├── worker/
│   ├── executor/
│   └── proto/
│
├── docs/
│   └── IMPLEMENTATION_SUMMARY.md
│
└── docker-compose.yml
```

---

## 🎭 Demo Accounts

Create accounts with:

* **User** — Personal tasks
* **Manager** — Team & assignments
* **Admin** — Full system control

**Default Admin:** Select “Administrator” when creating the first account.

---

## 📊 System Architecture

```
Frontend (Next.js)
   │ REST + WebSocket
   ▼
Node.js Backend ─────────── WebSocket Server
   │ REST API               │ Real-time rooms
   ▼                        ▼
Bull Queue (Redis)  ←→  Go Worker Services (gRPC)
   │                         │
   ▼                         ▼
PostgreSQL               Redis Cache
```

---

## 🔧 Development Commands

```bash
npm install
npm run dev
npm run build
npm start

npx prisma db push
npx prisma studio
```

### Go services

```bash
cd go-services/worker && ./run-dev.sh
cd go-services/executor && ./run-dev.sh
```

---

## 📈 Performance Metrics

* **Job Processing:** 100+ jobs/second (3 workers)
* **WebSocket Latency:** <100ms
* **API Response Time:** <200ms
* **Worker Scaling:** 1–10 workers
* **Concurrent Users:** 100+ tested

---

## 🐛 Troubleshooting

### Database

```bash
docker-compose up postgres
psql postgresql://karmayogi:karmayogi123@localhost:5432/karmayogi
```

### Redis

```bash
docker-compose up redis
redis-cli ping
```

### Go Services

```bash
go build -o ../../bin/worker
```

### WebSocket

* Check `NEXT_PUBLIC_WS_URL`
* Verify CORS
* Ensure JWT token is valid and not expired — the server returns close code `4001` for expired tokens
* Client must respond to `server:ping` with `client:pong` within the 30 s heartbeat window or the connection will be terminated

---

## 📝 Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full history of improvements.

---

## 📚 Documentation

See full documentation in:

```
docs/IMPLEMENTATION_SUMMARY.md
```

---

## 🤝 Contributing

1. Fork repo
2. Create branch
3. Commit changes
4. Push branch
5. Open PR

---

## 🌟 Acknowledgments

* Bull Queue
* Prisma
* Socket.IO
* gRPC

---

## 🎯 Roadmap

* Kubernetes deployment
* Grafana + Prometheus monitoring
* Job marketplace
* Multi-region support
* ML-based workload prediction
* Slack/Teams integration
* Advanced scheduling (cron jobs)

---

## 📄 License

MIT License — see `LICENSE` file

---

## 👨‍💻 Developer

**Saurav Teli**  
GitHub: [fromsaurav](https://github.com/fromsaurav)  
LinkedIn: [Saurav Teli](https://www.linkedin.com/in/saurav-teli-89a27a263/)  
Website: [www.fromsaurav.tech](https://www.fromsaurav.tech/)  
Email: telisaurav44@gmail.com

---

<div align="center">
<strong>🚀 Built for scale. Designed for teams. Powered by distributed systems.</strong>
<br/>
Documentation | Report Issues | Request Features
<br/>
Made with ❤️ by Saurav Teli
</div>


---



**Last Updated:** December 2025
**Version:** 1.0.0
**Status:** Active Development
