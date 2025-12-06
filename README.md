# KarmaYogi

**Enterprise-grade Distributed Task Queue Management Platform**

A full-stack application for managing distributed task queues with real-time monitoring, role-based access control, and comprehensive analytics.

---

## 🚀 Features

- **Distributed Task Queue**: Scalable job processing with Redis/BullMQ
- **Role-Based Access Control**: Admin, Manager, and User roles with granular permissions
- **Real-time Monitoring**: Live updates via WebSockets for job status and metrics
- **Job Templates**: Pre-configured templates for common tasks
- **Advanced Analytics**: Comprehensive dashboards with Prometheus & Grafana
- **RESTful API**: Well-documented API endpoints for all operations
- **Modern UI**: Responsive Next.js frontend with dark mode support

---

## 🏗️ Architecture

### Tech Stack

**Backend:**
- FastAPI (Python) - Main API server
- Express.js (Node.js) - Queue management & WebSocket server
- PostgreSQL - Primary database
- Redis - Job queue & caching
- Prisma - Database ORM

**Frontend:**
- Next.js 15 (React 19)
- TypeScript
- Tailwind CSS
- Zustand - State management

**Infrastructure:**
- Docker & Docker Compose
- Prometheus - Metrics collection
- Grafana - Visualization & dashboards

### System Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Next.js   │─────>│  Express.js  │─────>│   Redis     │
│  Frontend   │      │  API Server  │      │   Queue     │
└─────────────┘      └──────────────┘      └─────────────┘
                             │                     │
                             ▼                     ▼
                      ┌──────────────┐      ┌─────────────┐
                      │  PostgreSQL  │      │   Workers   │
                      │   Database   │      │  (BullMQ)   │
                      └──────────────┘      └─────────────┘
                             │
                             ▼
                      ┌──────────────┐      ┌─────────────┐
                      │  Prometheus  │─────>│   Grafana   │
                      │   Metrics    │      │  Dashboard  │
                      └──────────────┘      └─────────────┘
```

---

## 📋 Prerequisites

- **Docker** & **Docker Compose** (recommended)
- **Node.js** 18+ and **npm/yarn/pnpm**
- **Python** 3.9+
- **PostgreSQL** 14+ (if not using Docker)
- **Redis** 7+ (if not using Docker)

---

## ⚡ Quick Start

### Option 1: Using Docker (Recommended)

```bash
# 1. Clone the repository
git clone <repository-url>
cd KarmaYogi

# 2. Create environment files
cp .env.example .env
cp karmayogi-frontend/.env.example karmayogi-frontend/.env.local

# 3. Start all services with Docker Compose
docker-compose up -d

# 4. Wait for services to initialize (30-60 seconds)
docker-compose logs -f

# 5. Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# Grafana: http://localhost:3001 (admin/admin)
# Prometheus: http://localhost:9090
```

### Option 2: Manual Setup

#### Backend Setup

```bash
# 1. Install Python dependencies
pip install -r requirements.txt

# 2. Set up environment variables
cp .env.example .env
# Edit .env with your database credentials

# 3. Run database migrations
npx prisma migrate dev

# 4. Seed the database (optional)
npm run seed

# 5. Start the backend server
npm run dev
```

#### Frontend Setup

```bash
# 1. Navigate to frontend directory
cd karmayogi-frontend

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your API URL

# 4. Start the development server
npm run dev
```

---

## 🔧 Configuration

### Environment Variables

**Backend (.env)**
```env
DATABASE_URL=postgresql://user:password@localhost:5432/karmayogi
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your-secret-key
PORT=8000
```

**Frontend (karmayogi-frontend/.env.local)**
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

---

## 📚 Available Scripts

### Backend Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run seed         # Seed database with sample data
npm run migrate      # Run database migrations
```

### Frontend Scripts

```bash
npm run dev          # Start development server (port 3000)
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

### Docker Commands

```bash
docker-compose up -d              # Start all services
docker-compose down               # Stop all services
docker-compose logs -f            # View logs
docker-compose restart <service>  # Restart specific service
```

---

## 👥 Default Users

After seeding the database, you can login with:

| Role    | Email              | Password   |
|---------|-------------------|------------|
| Admin   | admin@example.com | admin123   |
| Manager | manager@example.com | manager123 |
| User    | user@example.com  | user123    |

---

## 📖 API Documentation

API documentation is available at:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

---

## 🗂️ Project Structure

```
KarmaYogi/
├── src/                      # Backend source code
│   ├── controllers/          # API controllers
│   ├── routes/              # API routes
│   ├── middleware/          # Custom middleware
│   ├── services/            # Business logic
│   ├── workers/             # Job processors
│   └── utils/               # Utilities
├── karmayogi-frontend/      # Next.js frontend
│   ├── src/
│   │   ├── app/            # App router pages
│   │   ├── components/     # React components
│   │   ├── lib/            # Utilities & API client
│   │   └── stores/         # State management
├── prisma/                  # Database schema & migrations
├── docker/                  # Docker configurations
├── docs/                    # Documentation
├── docker-compose.yml       # Docker Compose config
└── README.md               # This file
```

---

## 🔐 Role-Based Access Control

### Admin
- Full system access
- User management
- System configuration
- All job operations

### Manager
- Team management
- Job creation & monitoring
- Template management
- Team member job access

### User
- Create personal jobs
- View own jobs
- Basic analytics

---

## 📊 Monitoring & Metrics

### Prometheus Metrics
- Job completion rates
- Queue depths
- API response times
- Worker health status

### Grafana Dashboards
Access Grafana at http://localhost:3001 with default credentials (admin/admin)

Pre-configured dashboards:
- System Overview
- Job Queue Metrics
- API Performance
- Worker Pool Status

---

## 🧪 Testing

```bash
# Backend tests
npm run test

# Frontend tests
cd karmayogi-frontend
npm run test

# E2E tests
npm run test:e2e
```

---

## 🚀 Deployment

### Production Build

```bash
# Build backend
npm run build

# Build frontend
cd karmayogi-frontend
npm run build

# Start production servers
npm run start
```

### Docker Production

```bash
docker-compose -f docker-compose.prod.yml up -d
```

---

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📧 Support

For issues and questions:
- Create an issue in the GitHub repository
- Check the [documentation](./docs/) folder

---

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Powered by [FastAPI](https://fastapi.tiangolo.com/)
- Queue management with [BullMQ](https://docs.bullmq.io/)
- Monitoring with [Prometheus](https://prometheus.io/) & [Grafana](https://grafana.com/)

---

**Made with ❤️ for distributed task management**
