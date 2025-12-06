package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"sync/atomic"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

type Job struct {
	ID        string                 `json:"id"`
	Type      string                 `json:"type"`
	Payload   map[string]interface{} `json:"payload"`
	Priority  int                    `json:"priority"`
	Timeout   int                    `json:"timeout"`
	UserID    string                 `json:"user_id"`
	Metadata  map[string]string      `json:"metadata"`
	Status    string                 `json:"status"`
	CreatedAt time.Time              `json:"created_at"`
}

type WorkerPool struct {
	size        int
	jobs        chan *Job
	results     chan *JobResult
	workers     []*Worker
	db          *pgxpool.Pool
	redis       *redis.Client
	running     atomic.Bool
	activeJobs  atomic.Int32
	totalJobs   atomic.Int64
	failedJobs  atomic.Int64
	mu          sync.RWMutex
}

type Worker struct {
	id          string
	pool        *WorkerPool
	currentJob  *Job
	status      string
	startedAt   time.Time
	mu          sync.RWMutex
}

type JobResult struct {
	JobID       string
	Status      string
	Result      map[string]interface{}
	Error       string
	StartedAt   time.Time
	CompletedAt time.Time
	DurationMS  int32
}

func NewWorkerPool(size int, db *pgxpool.Pool, redis *redis.Client) *WorkerPool {
	return &WorkerPool{
		size:    size,
		jobs:    make(chan *Job, size*10), // Buffer for queued jobs
		results: make(chan *JobResult, size*10),
		db:      db,
		redis:   redis,
	}
}

func (wp *WorkerPool) Start() {
	wp.running.Store(true)
	wp.workers = make([]*Worker, wp.size)

	// Create worker goroutines
	for i := 0; i < wp.size; i++ {
		worker := &Worker{
			id:        fmt.Sprintf("worker-%d", i+1),
			pool:      wp,
			status:    "idle",
			startedAt: time.Now(),
		}
		wp.workers[i] = worker
		go worker.start()
	}

	// Start result processor
	go wp.processResults()

	// Start Redis subscriber for new jobs
	go wp.subscribeToJobs()

	log.Printf("✅ Started %d worker goroutines", wp.size)
}

func (wp *WorkerPool) Stop() {
	wp.running.Store(false)
	close(wp.jobs)
	log.Println("⏸️  Worker pool stopped")
}

func (wp *WorkerPool) SubmitJob(job *Job) {
	if !wp.running.Load() {
		log.Println("⚠️  Worker pool not running, rejecting job")
		return
	}
	wp.jobs <- job
	wp.totalJobs.Add(1)
}

func (wp *WorkerPool) GetStatus() map[string]interface{} {
	wp.mu.RLock()
	defer wp.mu.RUnlock()

	activeWorkers := 0
	idleWorkers := 0
	workerInfos := make([]map[string]interface{}, len(wp.workers))

	for i, worker := range wp.workers {
		worker.mu.RLock()
		if worker.status == "busy" {
			activeWorkers++
		} else {
			idleWorkers++
		}

		workerInfo := map[string]interface{}{
			"worker_id":      worker.id,
			"status":         worker.status,
			"current_job_id": "",
			"started_at":     worker.startedAt.Unix(),
		}

		if worker.currentJob != nil {
			workerInfo["current_job_id"] = worker.currentJob.ID
		}

		workerInfos[i] = workerInfo
		worker.mu.RUnlock()
	}

	return map[string]interface{}{
		"active_workers":  activeWorkers,
		"idle_workers":    idleWorkers,
		"queue_size":      len(wp.jobs),
		"jobs_processed":  wp.totalJobs.Load(),
		"jobs_failed":     wp.failedJobs.Load(),
		"workers":         workerInfos,
	}
}

func (w *Worker) start() {
	for job := range w.pool.jobs {
		w.processJob(job)
	}
}

func (w *Worker) processJob(job *Job) {
	w.mu.Lock()
	w.status = "busy"
	w.currentJob = job
	w.mu.Unlock()

	w.pool.activeJobs.Add(1)
	defer w.pool.activeJobs.Add(-1)

	startedAt := time.Now()
	result := &JobResult{
		JobID:     job.ID,
		Status:    "running",
		StartedAt: startedAt,
	}

	// Update job status to running
	w.updateJobStatus(job.ID, "running", nil, "")

	// Process based on job type
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(job.Timeout)*time.Second)
	defer cancel()

	processResult, err := w.executeJob(ctx, job)

	completedAt := time.Now()
	duration := completedAt.Sub(startedAt)

	if err != nil {
		result.Status = "failed"
		result.Error = err.Error()
		w.pool.failedJobs.Add(1)
		log.Printf("❌ Job %s failed: %v", job.ID, err)
	} else {
		result.Status = "completed"
		result.Result = processResult
		log.Printf("✅ Job %s completed in %v", job.ID, duration)
	}

	result.CompletedAt = completedAt
	result.DurationMS = int32(duration.Milliseconds())

	// Send result
	w.pool.results <- result

	w.mu.Lock()
	w.status = "idle"
	w.currentJob = nil
	w.mu.Unlock()
}

func (w *Worker) executeJob(ctx context.Context, job *Job) (map[string]interface{}, error) {
	// Simulate different job types
	switch job.Type {
	case "email":
		return w.executeEmailJob(ctx, job)
	case "file_processing":
		return w.executeFileProcessingJob(ctx, job)
	case "data_analytics":
		return w.executeDataAnalyticsJob(ctx, job)
	case "api_call":
		return w.executeAPICallJob(ctx, job)
	case "custom_script":
		return w.executeCustomScriptJob(ctx, job)
	default:
		return w.executeGenericJob(ctx, job)
	}
}

func (w *Worker) executeEmailJob(ctx context.Context, job *Job) (map[string]interface{}, error) {
	// Simulate email processing
	time.Sleep(100 * time.Millisecond)
	return map[string]interface{}{
		"emails_sent": 1,
		"status":      "sent",
	}, nil
}

func (w *Worker) executeFileProcessingJob(ctx context.Context, job *Job) (map[string]interface{}, error) {
	// Simulate file processing
	time.Sleep(200 * time.Millisecond)
	return map[string]interface{}{
		"records_processed": 1000,
		"status":            "completed",
	}, nil
}

func (w *Worker) executeDataAnalyticsJob(ctx context.Context, job *Job) (map[string]interface{}, error) {
	// Simulate data analytics
	time.Sleep(300 * time.Millisecond)
	return map[string]interface{}{
		"rows_analyzed": 5000,
		"aggregations":  map[string]float64{"avg": 123.45, "sum": 617.25},
	}, nil
}

func (w *Worker) executeAPICallJob(ctx context.Context, job *Job) (map[string]interface{}, error) {
	// Simulate API call
	time.Sleep(150 * time.Millisecond)
	return map[string]interface{}{
		"status_code": 200,
		"response":    "Success",
	}, nil
}

func (w *Worker) executeCustomScriptJob(ctx context.Context, job *Job) (map[string]interface{}, error) {
	// Simulate custom script execution
	time.Sleep(250 * time.Millisecond)
	return map[string]interface{}{
		"exit_code": 0,
		"output":    "Script executed successfully",
	}, nil
}

func (w *Worker) executeGenericJob(ctx context.Context, job *Job) (map[string]interface{}, error) {
	// Generic job processing
	time.Sleep(100 * time.Millisecond)
	return map[string]interface{}{
		"status": "completed",
	}, nil
}

func (w *Worker) updateJobStatus(jobID, status string, result map[string]interface{}, errorMsg string) {
	ctx := context.Background()

	resultJSON, _ := json.Marshal(result)
	query := `
		UPDATE jobs
		SET status = $1, result = $2, error = $3, updated_at = NOW()
		WHERE id = $4
	`
	_, err := w.pool.db.Exec(ctx, query, status, resultJSON, errorMsg, jobID)
	if err != nil {
		log.Printf("Failed to update job status: %v", err)
	}
}

func (wp *WorkerPool) processResults() {
	for result := range wp.results {
		// Update database
		wp.updateJobInDatabase(result)

		// Publish to Redis for real-time updates
		wp.publishJobUpdate(result)
	}
}

func (wp *WorkerPool) updateJobInDatabase(result *JobResult) {
	ctx := context.Background()

	resultJSON, _ := json.Marshal(result.Result)
	query := `
		UPDATE jobs
		SET status = $1, result = $2, error = $3,
		    completed_at = $4, duration = $5, updated_at = NOW()
		WHERE id = $6
	`

	_, err := wp.db.Exec(ctx, query,
		result.Status,
		resultJSON,
		result.Error,
		result.CompletedAt,
		result.DurationMS,
		result.JobID,
	)

	if err != nil {
		log.Printf("Failed to update job in database: %v", err)
	}
}

func (wp *WorkerPool) publishJobUpdate(result *JobResult) {
	ctx := context.Background()

	update := map[string]interface{}{
		"job_id":       result.JobID,
		"status":       result.Status,
		"result":       result.Result,
		"error":        result.Error,
		"completed_at": result.CompletedAt,
		"duration_ms":  result.DurationMS,
	}

	updateJSON, _ := json.Marshal(update)

	err := wp.redis.Publish(ctx, "job:updates", updateJSON).Err()
	if err != nil {
		log.Printf("Failed to publish job update: %v", err)
	}
}

func (wp *WorkerPool) subscribeToJobs() {
	ctx := context.Background()
	pubsub := wp.redis.Subscribe(ctx, "job:created")
	defer pubsub.Close()

	ch := pubsub.Channel()

	for msg := range ch {
		var job Job
		if err := json.Unmarshal([]byte(msg.Payload), &job); err != nil {
			log.Printf("Failed to unmarshal job: %v", err)
			continue
		}

		wp.SubmitJob(&job)
	}
}
