package main

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

// WorkerService implements the gRPC WorkerService interface
type WorkerService struct {
	UnimplementedWorkerServiceServer
	pool  *WorkerPool
	db    *pgxpool.Pool
	redis *redis.Client
}

func NewWorkerService(pool *WorkerPool, db *pgxpool.Pool, redis *redis.Client) *WorkerService {
	return &WorkerService{
		pool:  pool,
		db:    db,
		redis: redis,
	}
}

func (s *WorkerService) ProcessJob(ctx context.Context, req *JobRequest) (*JobResponse, error) {
	// Parse payload
	var payload map[string]interface{}
	if err := json.Unmarshal([]byte(req.Payload), &payload); err != nil {
		return &JobResponse{
			JobId:  req.JobId,
			Status: "failed",
			Error:  fmt.Sprintf("invalid payload: %v", err),
		}, nil
	}

	// Convert metadata
	metadata := make(map[string]string)
	for k, v := range req.Metadata {
		metadata[k] = v
	}

	// Create job
	job := &Job{
		ID:       req.JobId,
		Type:     req.JobType,
		Payload:  payload,
		Priority: int(req.Priority),
		Timeout:  int(req.Timeout),
		UserID:   req.UserId,
		Metadata: metadata,
		Status:   "pending",
	}

	// Submit to worker pool
	s.pool.SubmitJob(job)

	return &JobResponse{
		JobId:     req.JobId,
		Status:    "queued",
		StartedAt: time.Now().Unix(),
	}, nil
}

func (s *WorkerService) GetWorkerStatus(ctx context.Context, req *Empty) (*WorkerStatus, error) {
	status := s.pool.GetStatus()

	workerInfos := make([]*WorkerInfo, 0)
	if workers, ok := status["workers"].([]map[string]interface{}); ok {
		for _, w := range workers {
			info := &WorkerInfo{
				WorkerId:     w["worker_id"].(string),
				Status:       w["status"].(string),
				CurrentJobId: w["current_job_id"].(string),
				StartedAt:    w["started_at"].(int64),
			}
			workerInfos = append(workerInfos, info)
		}
	}

	return &WorkerStatus{
		ActiveWorkers:  int32(status["active_workers"].(int)),
		IdleWorkers:    int32(status["idle_workers"].(int)),
		QueueSize:      int32(status["queue_size"].(int)),
		JobsProcessed:  int32(status["jobs_processed"].(int64)),
		JobsFailed:     int32(status["jobs_failed"].(int64)),
		Workers:        workerInfos,
	}, nil
}

func (s *WorkerService) CancelJob(ctx context.Context, req *CancelRequest) (*CancelResponse, error) {
	// Find and cancel the job
	// This is a simplified implementation
	query := `
		UPDATE jobs
		SET status = 'cancelled', error = $1, updated_at = NOW()
		WHERE id = $2 AND status IN ('pending', 'running')
	`

	result, err := s.db.Exec(ctx, query, req.Reason, req.JobId)
	if err != nil {
		return &CancelResponse{
			Success: false,
			Message: fmt.Sprintf("failed to cancel job: %v", err),
		}, nil
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		return &CancelResponse{
			Success: false,
			Message: "job not found or already completed",
		}, nil
	}

	// Publish cancellation event
	cancelEvent := map[string]interface{}{
		"job_id": req.JobId,
		"reason": req.Reason,
		"status": "cancelled",
	}
	eventJSON, _ := json.Marshal(cancelEvent)
	s.redis.Publish(ctx, "job:cancelled", eventJSON)

	return &CancelResponse{
		Success: true,
		Message: "job cancelled successfully",
	}, nil
}

func (s *WorkerService) StreamJobUpdates(req *JobRequest, stream WorkerService_StreamJobUpdatesServer) error {
	ctx := stream.Context()
	pubsub := s.redis.Subscribe(ctx, fmt.Sprintf("job:%s:updates", req.JobId))
	defer pubsub.Close()

	ch := pubsub.Channel()

	for {
		select {
		case msg := <-ch:
			var update map[string]interface{}
			if err := json.Unmarshal([]byte(msg.Payload), &update); err != nil {
				continue
			}

			jobUpdate := &JobUpdate{
				JobId:     req.JobId,
				Status:    update["status"].(string),
				Timestamp: time.Now().Unix(),
			}

			if progress, ok := update["progress"].(float64); ok {
				jobUpdate.Progress = int32(progress)
			}

			if message, ok := update["message"].(string); ok {
				jobUpdate.Message = message
			}

			if err := stream.Send(jobUpdate); err != nil {
				return err
			}

		case <-ctx.Done():
			return ctx.Err()
		}
	}
}
