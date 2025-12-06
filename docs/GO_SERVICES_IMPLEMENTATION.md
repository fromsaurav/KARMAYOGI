# Go Services Implementation Guide

This document provides step-by-step implementation for integrating Go microservices into KarmaYogi.

---

## Quick Start

### 1. Install Go
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install golang-go

# macOS
brew install go

# Verify installation
go version  # Should be 1.22+
```

### 2. Initialize Go Modules
```bash
cd /home/saurav/Saurav/Projects/KarmaYogi
mkdir -p go-services/{worker,executor,loadbalancer,metrics,shared}

# Initialize each service
cd go-services/worker && go mod init github.com/yourusername/karmayogi/go-services/worker
cd ../executor && go mod init github.com/yourusername/karmayogi/go-services/executor
cd ../loadbalancer && go mod init github.com/yourusername/karmayogi/go-services/loadbalancer
cd ../metrics && go mod init github.com/yourusername/karmayogi/go-services/metrics
cd ../shared && go mod init github.com/yourusername/karmayogi/go-services/shared
```

---

## Service 1: Go Worker Service

### Directory Structure
```
go-services/worker/
├── main.go
├── worker.go
├── processor.go
├── config.go
├── proto/
│   └── worker.proto
└── go.mod
```

### proto/worker.proto
```protobuf
syntax = "proto3";

package worker;

option go_package = "github.com/yourusername/karmayogi/go-services/worker/proto";

service WorkerService {
  rpc ProcessJob(JobRequest) returns (JobResponse);
  rpc GetStatus(Empty) returns (WorkerStatus);
  rpc CancelJob(CancelRequest) returns (CancelResponse);
}

message JobRequest {
  string job_id = 1;
  string job_type = 2;
  string payload = 3;  // JSON string
  int32 priority = 4;
  string user_id = 5;
}

message JobResponse {
  string job_id = 1;
  string status = 2;  // success, failed, processing
  string result = 3;  // JSON string
  string error = 4;
}

message Empty {}

message WorkerStatus {
  int32 active_jobs = 1;
  int32 completed_jobs = 2;
  int32 failed_jobs = 3;
  double cpu_usage = 4;
  int64 memory_usage = 5;
  bool healthy = 6;
}

message CancelRequest {
  string job_id = 1;
}

message CancelResponse {
  bool success = 1;
  string message = 2;
}
```

### config.go
```go
package main

import (
	"os"
	"strconv"
)

type Config struct {
	GRPCPort      string
	DatabaseURL   string
	RedisURL      string
	WorkerPoolSize int
	MaxConcurrent int
}

func LoadConfig() *Config {
	workerPoolSize, _ := strconv.Atoi(getEnv("WORKER_POOL_SIZE", "100"))
	maxConcurrent, _ := strconv.Atoi(getEnv("MAX_CONCURRENT_JOBS", "1000"))

	return &Config{
		GRPCPort:       getEnv("GRPC_PORT", "50051"),
		DatabaseURL:    getEnv("DATABASE_URL", "postgresql://user:pass@localhost:5432/karmayogi"),
		RedisURL:       getEnv("REDIS_URL", "redis://localhost:6379"),
		WorkerPoolSize: workerPoolSize,
		MaxConcurrent:  maxConcurrent,
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
```

### worker.go
```go
package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	_ "github.com/lib/pq"
	"github.com/redis/go-redis/v9"
)

type Worker struct {
	ID            int
	JobChan       chan *Job
	DB            *sql.DB
	Redis         *redis.Client
	ActiveJobs    int
	CompletedJobs int
	FailedJobs    int
	mu            sync.Mutex
}

type Job struct {
	ID       string
	Type     string
	Payload  map[string]interface{}
	Priority int
	UserID   string
	Status   string
	Result   interface{}
	Error    string
}

type WorkerPool struct {
	Workers       []*Worker
	JobQueue      chan *Job
	DB            *sql.DB
	Redis         *redis.Client
	MaxConcurrent int
	wg            sync.WaitGroup
}

func NewWorkerPool(size int, maxConcurrent int, db *sql.DB, redisClient *redis.Client) *WorkerPool {
	pool := &WorkerPool{
		Workers:       make([]*Worker, size),
		JobQueue:      make(chan *Job, maxConcurrent),
		DB:            db,
		Redis:         redisClient,
		MaxConcurrent: maxConcurrent,
	}

	// Initialize workers
	for i := 0; i < size; i++ {
		worker := &Worker{
			ID:      i + 1,
			JobChan: make(chan *Job, 10),
			DB:      db,
			Redis:   redisClient,
		}
		pool.Workers[i] = worker
		pool.wg.Add(1)
		go worker.Start(&pool.wg)
	}

	// Start job distributor
	go pool.Distribute()

	log.Printf("✅ Worker pool started with %d workers, max concurrent: %d", size, maxConcurrent)
	return pool
}

func (wp *WorkerPool) Distribute() {
	for job := range wp.JobQueue {
		// Find least busy worker
		leastBusyWorker := wp.getLeastBusyWorker()
		leastBusyWorker.JobChan <- job
	}
}

func (wp *WorkerPool) getLeastBusyWorker() *Worker {
	var leastBusy *Worker
	minJobs := int(^uint(0) >> 1) // Max int

	for _, worker := range wp.Workers {
		worker.mu.Lock()
		activeJobs := worker.ActiveJobs
		worker.mu.Unlock()

		if activeJobs < minJobs {
			minJobs = activeJobs
			leastBusy = worker
		}
	}

	return leastBusy
}

func (w *Worker) Start(wg *sync.WaitGroup) {
	defer wg.Done()

	for job := range w.JobChan {
		w.mu.Lock()
		w.ActiveJobs++
		w.mu.Unlock()

		// Process job
		w.ProcessJob(job)

		w.mu.Lock()
		w.ActiveJobs--
		if job.Status == "COMPLETED" {
			w.CompletedJobs++
		} else if job.Status == "FAILED" {
			w.FailedJobs++
		}
		w.mu.Unlock()
	}
}

func (w *Worker) ProcessJob(job *Job) {
	ctx := context.Background()
	startTime := time.Now()

	log.Printf("Worker %d processing job %s (type: %s)", w.ID, job.ID, job.Type)

	// Update job status to ACTIVE
	w.updateJobStatus(job.ID, "ACTIVE", "", "")

	// Process based on job type
	var result interface{}
	var err error

	switch job.Type {
	case "FILE_PROCESSING":
		result, err = w.processFile(job)
	case "DATA_ANALYTICS":
		result, err = w.processDataAnalytics(job)
	case "EMAIL_TASK":
		result, err = w.sendEmail(job)
	case "API_INTEGRATION":
		result, err = w.callAPI(job)
	case "CUSTOM_SCRIPT":
		result, err = w.executeScript(job)
	default:
		err = fmt.Errorf("unknown job type: %s", job.Type)
	}

	duration := time.Since(startTime)

	if err != nil {
		log.Printf("❌ Worker %d failed job %s: %v (took %v)", w.ID, job.ID, err, duration)
		w.updateJobStatus(job.ID, "FAILED", "", err.Error())

		// Publish failure event to Redis
		w.publishJobEvent(ctx, "job:failed", job.ID)
	} else {
		log.Printf("✅ Worker %d completed job %s (took %v)", w.ID, job.ID, duration)
		resultJSON, _ := json.Marshal(result)
		w.updateJobStatus(job.ID, "COMPLETED", string(resultJSON), "")

		// Publish completion event to Redis
		w.publishJobEvent(ctx, "job:completed", job.ID)
	}
}

func (w *Worker) updateJobStatus(jobID, status, result, errorMsg string) {
	query := `
		UPDATE jobs
		SET status = $1, result = $2, error = $3, updated_at = NOW()
		WHERE id = $4
	`

	var resultJSON interface{}
	if result != "" {
		json.Unmarshal([]byte(result), &resultJSON)
	}

	_, err := w.DB.Exec(query, status, resultJSON, errorMsg, jobID)
	if err != nil {
		log.Printf("Failed to update job status: %v", err)
	}
}

func (w *Worker) publishJobEvent(ctx context.Context, event, jobID string) {
	message := map[string]string{
		"event":  event,
		"job_id": jobID,
		"time":   time.Now().Format(time.RFC3339),
	}

	msgJSON, _ := json.Marshal(message)
	w.Redis.Publish(ctx, "job_events", msgJSON)
}

// Job processors (simplified examples)
func (w *Worker) processFile(job *Job) (interface{}, error) {
	// Simulate file processing
	time.Sleep(100 * time.Millisecond)
	return map[string]interface{}{
		"processed": true,
		"lines":     1000,
		"size":      "5MB",
	}, nil
}

func (w *Worker) processDataAnalytics(job *Job) (interface{}, error) {
	// Simulate data analytics
	time.Sleep(150 * time.Millisecond)
	return map[string]interface{}{
		"calculated": true,
		"metrics": map[string]float64{
			"average": 42.5,
			"sum":     1000.0,
			"count":   500,
		},
	}, nil
}

func (w *Worker) sendEmail(job *Job) (interface{}, error) {
	// Simulate email sending
	time.Sleep(50 * time.Millisecond)
	return map[string]interface{}{
		"sent":      true,
		"messageId": "msg_123456",
	}, nil
}

func (w *Worker) callAPI(job *Job) (interface{}, error) {
	// Simulate API call
	time.Sleep(200 * time.Millisecond)
	return map[string]interface{}{
		"success":    true,
		"statusCode": 200,
		"data":       "API response data",
	}, nil
}

func (w *Worker) executeScript(job *Job) (interface{}, error) {
	// Simulate script execution
	time.Sleep(300 * time.Millisecond)
	return map[string]interface{}{
		"executed": true,
		"exitCode": 0,
		"output":   "Script completed successfully",
	}, nil
}

func (wp *WorkerPool) GetStats() (int, int, int) {
	var totalActive, totalCompleted, totalFailed int

	for _, worker := range wp.Workers {
		worker.mu.Lock()
		totalActive += worker.ActiveJobs
		totalCompleted += worker.CompletedJobs
		totalFailed += worker.FailedJobs
		worker.mu.Unlock()
	}

	return totalActive, totalCompleted, totalFailed
}

func (wp *WorkerPool) Shutdown() {
	close(wp.JobQueue)
	for _, worker := range wp.Workers {
		close(worker.JobChan)
	}
	wp.wg.Wait()
	log.Println("✅ Worker pool shut down gracefully")
}
```

### main.go
```go
package main

import (
	"context"
	"database/sql"
	"log"
	"net"
	"os"
	"os/signal"
	"syscall"

	_ "github.com/lib/pq"
	"github.com/redis/go-redis/v9"
	"google.golang.org/grpc"
	pb "github.com/yourusername/karmayogi/go-services/worker/proto"
)

type server struct {
	pb.UnimplementedWorkerServiceServer
	workerPool *WorkerPool
	db         *sql.DB
	redis      *redis.Client
}

func (s *server) ProcessJob(ctx context.Context, req *pb.JobRequest) (*pb.JobResponse, error) {
	log.Printf("Received job request: %s (type: %s)", req.JobId, req.JobType)

	// Create job
	job := &Job{
		ID:       req.JobId,
		Type:     req.JobType,
		Payload:  make(map[string]interface{}),
		Priority: int(req.Priority),
		UserID:   req.UserId,
		Status:   "PENDING",
	}

	// Parse payload
	// json.Unmarshal([]byte(req.Payload), &job.Payload)

	// Add to queue
	s.workerPool.JobQueue <- job

	return &pb.JobResponse{
		JobId:  req.JobId,
		Status: "QUEUED",
		Result: "",
		Error:  "",
	}, nil
}

func (s *server) GetStatus(ctx context.Context, req *pb.Empty) (*pb.WorkerStatus, error) {
	active, completed, failed := s.workerPool.GetStats()

	return &pb.WorkerStatus{
		ActiveJobs:    int32(active),
		CompletedJobs: int32(completed),
		FailedJobs:    int32(failed),
		CpuUsage:      0.0,    // Implement actual CPU monitoring
		MemoryUsage:   0,      // Implement actual memory monitoring
		Healthy:       true,
	}, nil
}

func (s *server) CancelJob(ctx context.Context, req *pb.CancelRequest) (*pb.CancelResponse, error) {
	// Implement job cancellation logic
	return &pb.CancelResponse{
		Success: true,
		Message: "Job cancelled successfully",
	}, nil
}

func main() {
	log.Println("🚀 Starting Go Worker Service...")

	// Load configuration
	config := LoadConfig()

	// Connect to PostgreSQL
	db, err := sql.Open("postgres", config.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	log.Println("✅ Connected to PostgreSQL")

	// Connect to Redis
	redisClient := redis.NewClient(&redis.Options{
		Addr: config.RedisURL,
	})
	defer redisClient.Close()

	ctx := context.Background()
	if err := redisClient.Ping(ctx).Err(); err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}

	log.Println("✅ Connected to Redis")

	// Create worker pool
	workerPool := NewWorkerPool(config.WorkerPoolSize, config.MaxConcurrent, db, redisClient)

	// Start gRPC server
	lis, err := net.Listen("tcp", ":"+config.GRPCPort)
	if err != nil {
		log.Fatalf("Failed to listen: %v", err)
	}

	grpcServer := grpc.NewServer()
	pb.RegisterWorkerServiceServer(grpcServer, &server{
		workerPool: workerPool,
		db:         db,
		redis:      redisClient,
	})

	log.Printf("✅ gRPC server listening on port %s", config.GRPCPort)

	// Handle graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-sigChan
		log.Println("Received shutdown signal, shutting down gracefully...")
		workerPool.Shutdown()
		grpcServer.GracefulStop()
		os.Exit(0)
	}()

	if err := grpcServer.Serve(lis); err != nil {
		log.Fatalf("Failed to serve: %v", err)
	}
}
```

---

## Service 2: Node.js gRPC Client

### src/grpc/worker.client.ts
```typescript
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { logger } from '../utils/logger';

const PROTO_PATH = path.join(__dirname, '../../go-services/worker/proto/worker.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const workerProto = grpc.loadPackageDefinition(packageDefinition).worker as any;

class WorkerClient {
  private client: any;
  private connected: boolean = false;

  constructor() {
    const GRPC_HOST = process.env.GRPC_HOST || 'localhost:50051';
    this.client = new workerProto.WorkerService(
      GRPC_HOST,
      grpc.credentials.createInsecure()
    );

    this.testConnection();
  }

  private testConnection() {
    this.client.GetStatus({}, (error: any, response: any) => {
      if (error) {
        logger.warn('Go Worker Service not available:', error.message);
        this.connected = false;
      } else {
        logger.info('✅ Connected to Go Worker Service');
        this.connected = true;
      }
    });
  }

  async processJob(job: {
    jobId: string;
    jobType: string;
    payload: string;
    priority: number;
    userId: string;
  }): Promise<{ jobId: string; status: string; result: string; error: string }> {
    return new Promise((resolve, reject) => {
      this.client.ProcessJob(job, (error: any, response: any) => {
        if (error) {
          logger.error('gRPC ProcessJob error:', error);
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  async getWorkerStatus(): Promise<{
    activeJobs: number;
    completedJobs: number;
    failedJobs: number;
    cpuUsage: number;
    memoryUsage: number;
    healthy: boolean;
  }> {
    return new Promise((resolve, reject) => {
      this.client.GetStatus({}, (error: any, response: any) => {
        if (error) {
          logger.error('gRPC GetStatus error:', error);
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  async cancelJob(jobId: string): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve, reject) => {
      this.client.CancelJob({ job_id: jobId }, (error: any, response: any) => {
        if (error) {
          logger.error('gRPC CancelJob error:', error);
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  isConnected(): boolean {
    return this.connected;
  }
}

export const workerClient = new WorkerClient();
```

### Update Job Controller (src/controllers/jobController.ts)
```typescript
import { workerClient } from '../grpc/worker.client';

export async function submitJob(req: Request, res: Response): Promise<void> {
  try {
    // ... existing validation code ...

    // Create job in database
    const job = await prisma.job.create({
      data: {
        type: jobType,
        payload: jobData,
        priority: jobPriority,
        userId: req.user!.userId,
        status: 'PENDING'
      }
    });

    // Send to Go worker if available, fallback to Node.js
    if (workerClient.isConnected()) {
      try {
        await workerClient.processJob({
          jobId: job.id,
          jobType: job.type,
          payload: JSON.stringify(job.payload),
          priority: job.priority === 'HIGH' ? 3 : job.priority === 'MEDIUM' ? 2 : 1,
          userId: req.user!.userId
        });

        logger.info(`Job ${job.id} sent to Go worker`);
      } catch (error) {
        logger.error('Failed to send to Go worker, using Node.js fallback:', error);
        // Fallback to existing Node.js queue
        await addJobToQueue(job);
      }
    } else {
      // Use existing Node.js queue
      await addJobToQueue(job);
    }

    res.status(201).json({
      success: true,
      message: 'Job submitted successfully',
      data: { jobId: job.id, status: job.status }
    });
  } catch (error) {
    logger.error('Job submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit job'
    });
  }
}
```

---

## Docker Compose Setup

### docker-compose.yml
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: karmayogi
      POSTGRES_USER: karmayogi_user
      POSTGRES_PASSWORD: karmayogi_pass
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  go-worker:
    build:
      context: .
      dockerfile: go-services/worker/Dockerfile
    environment:
      GRPC_PORT: 50051
      DATABASE_URL: postgresql://karmayogi_user:karmayogi_pass@postgres:5432/karmayogi
      REDIS_URL: redis://redis:6379
      WORKER_POOL_SIZE: 100
      MAX_CONCURRENT_JOBS: 1000
    ports:
      - "50051:50051"
    depends_on:
      - postgres
      - redis

  node-api:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: postgresql://karmayogi_user:karmayogi_pass@postgres:5432/karmayogi
      REDIS_URL: redis://redis:6379
      GRPC_HOST: go-worker:50051
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - redis
      - go-worker

  frontend:
    build:
      context: ./karmayogi-frontend
      dockerfile: Dockerfile
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:3000
    ports:
      - "3001:3001"
    depends_on:
      - node-api

volumes:
  postgres_data:
  redis_data:
```

### go-services/worker/Dockerfile
```dockerfile
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Copy go mod files
COPY go-services/worker/go.mod go-services/worker/go.sum ./
RUN go mod download

# Copy source code
COPY go-services/worker/ ./

# Build
RUN CGO_ENABLED=0 GOOS=linux go build -o worker main.go

# Final stage
FROM alpine:latest

WORKDIR /app

COPY --from=builder /app/worker .

EXPOSE 50051

CMD ["./worker"]
```

---

## Installation Steps

### 1. Install Dependencies
```bash
# Node.js packages
npm install @grpc/grpc-js @grpc/proto-loader

# Go packages (in go-services/worker/)
cd go-services/worker
go get google.golang.org/grpc
go get google.golang.org/protobuf
go get github.com/lib/pq
go get github.com/redis/go-redis/v9
```

### 2. Generate Protocol Buffers
```bash
# Install protoc compiler
# Ubuntu/Debian
sudo apt install protobuf-compiler

# macOS
brew install protobuf

# Generate Go code from proto
cd go-services/worker
protoc --go_out=. --go_opt=paths=source_relative \
  --go-grpc_out=. --go-grpc_opt=paths=source_relative \
  proto/worker.proto
```

### 3. Run Services
```bash
# Option 1: Docker Compose (recommended)
docker-compose up -d

# Option 2: Manual
# Terminal 1: PostgreSQL & Redis (if not using Docker)
# Terminal 2: Go Worker
cd go-services/worker && go run main.go

# Terminal 3: Node.js API
npm run dev

# Terminal 4: Frontend
cd karmayogi-frontend && npm run dev
```

---

## Testing

### Test Go Worker
```bash
# Using grpcurl
grpcurl -plaintext localhost:50051 worker.WorkerService/GetStatus

# Expected output:
{
  "activeJobs": 0,
  "completedJobs": 15,
  "failedJobs": 2,
  "healthy": true
}
```

### Test via Node.js API
```bash
# Submit a job (automatically uses Go worker if available)
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -H "Cookie: jwt=YOUR_JWT_TOKEN" \
  -d '{
    "type": "FILE_PROCESSING",
    "data": "{\"file\": \"test.csv\"}",
    "priority": 5
  }'
```

### Performance Test
```bash
# Install hey (HTTP load testing tool)
go install github.com/rakyll/hey@latest

# Test job submission throughput
hey -n 10000 -c 100 -m POST \
  -H "Content-Type: application/json" \
  -H "Cookie: jwt=YOUR_JWT_TOKEN" \
  -d '{"type":"FILE_PROCESSING","data":"{}","priority":5}' \
  http://localhost:3000/api/jobs
```

---

## Monitoring

### Add Prometheus Metrics (go-services/worker/metrics.go)
```go
package main

import (
	"net/http"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	jobsProcessed = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "jobs_processed_total",
			Help: "Total number of jobs processed",
		},
		[]string{"type", "status"},
	)

	jobDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name: "job_duration_seconds",
			Help: "Job processing duration in seconds",
		},
		[]string{"type"},
	)

	activeWorkers = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "active_workers",
			Help: "Number of active workers",
		},
	)
)

func init() {
	prometheus.MustRegister(jobsProcessed)
	prometheus.MustRegister(jobDuration)
	prometheus.MustRegister(activeWorkers)
}

func StartMetricsServer() {
	http.Handle("/metrics", promhttp.Handler())
	go http.ListenAndServe(":9090", nil)
}
```

---

## Next Steps

1. ✅ Implement Go Worker Service (this document)
2. ⏭️ Implement Go Executor Service (job-specific handlers)
3. ⏭️ Implement Load Balancer
4. ⏭️ Add Metrics & Monitoring
5. ⏭️ Deploy to Kubernetes

---

**Last Updated**: 2025-12-05
**Status**: Ready for implementation
**Estimated Time**: 1-2 weeks for complete integration
