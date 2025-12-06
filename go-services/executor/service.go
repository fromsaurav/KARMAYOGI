package main

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

type ExecutorService struct {
	UnimplementedExecutorServiceServer
	db    *pgxpool.Pool
	redis *redis.Client
}

func NewExecutorService(db *pgxpool.Pool, redis *redis.Client) *ExecutorService {
	return &ExecutorService{
		db:    db,
		redis: redis,
	}
}

// ProcessFile handles file processing jobs (CSV, JSON, XML parsing)
func (s *ExecutorService) ProcessFile(ctx context.Context, req *FileJobRequest) (*FileJobResponse, error) {
	log.Printf("Processing file job %s: %s (%s)", req.JobId, req.FilePath, req.FileType)

	var recordsProcessed int32
	var outputPath string
	stats := make(map[string]string)

	switch strings.ToLower(req.FileType) {
	case "csv":
		records, err := s.processCSV(req.FilePath, req.Operation)
		if err != nil {
			return &FileJobResponse{
				JobId:   req.JobId,
				Success: false,
				Error:   err.Error(),
			}, nil
		}
		recordsProcessed = int32(records)
		stats["format"] = "csv"

	case "json":
		records, err := s.processJSON(req.FilePath, req.Operation)
		if err != nil {
			return &FileJobResponse{
				JobId:   req.JobId,
				Success: false,
				Error:   err.Error(),
			}, nil
		}
		recordsProcessed = int32(records)
		stats["format"] = "json"

	default:
		return &FileJobResponse{
			JobId:   req.JobId,
			Success: false,
			Error:   fmt.Sprintf("unsupported file type: %s", req.FileType),
		}, nil
	}

	outputPath = fmt.Sprintf("/tmp/processed_%s_%s", req.JobId, req.FileType)
	stats["processing_time"] = time.Now().Format(time.RFC3339)

	return &FileJobResponse{
		JobId:             req.JobId,
		Success:           true,
		OutputPath:        outputPath,
		RecordsProcessed:  recordsProcessed,
		Stats:             stats,
	}, nil
}

// AnalyzeData handles data analytics jobs
func (s *ExecutorService) AnalyzeData(ctx context.Context, req *AnalyticsJobRequest) (*AnalyticsJobResponse, error) {
	log.Printf("Analyzing data for job %s: %s", req.JobId, req.DataSource)

	// Simulate data analytics with aggregations
	results := map[string]interface{}{
		"source":       req.DataSource,
		"query":        req.Query,
		"aggregations": req.Aggregations,
		"timestamp":    time.Now().Unix(),
		"summary": map[string]interface{}{
			"total_rows": 10000,
			"avg_value":  123.45,
			"max_value":  500.0,
			"min_value":  10.0,
		},
	}

	resultsJSON, _ := json.Marshal(results)

	return &AnalyticsJobResponse{
		JobId:        req.JobId,
		Success:      true,
		Results:      string(resultsJSON),
		RowsAnalyzed: 10000,
	}, nil
}

// SendEmail handles email sending jobs
func (s *ExecutorService) SendEmail(ctx context.Context, req *EmailJobRequest) (*EmailJobResponse, error) {
	log.Printf("Sending emails for job %s to %d recipients", req.JobId, len(req.Recipients))

	// Simulate email sending with concurrent goroutines
	emailsSent := 0
	emailsFailed := 0
	var failedRecipients []string

	for _, recipient := range req.Recipients {
		// Simulate email sending (replace with actual SMTP logic)
		if s.sendEmailToRecipient(recipient, req.Subject, req.Body) {
			emailsSent++
		} else {
			emailsFailed++
			failedRecipients = append(failedRecipients, recipient)
		}
	}

	return &EmailJobResponse{
		JobId:            req.JobId,
		Success:          emailsFailed == 0,
		EmailsSent:       int32(emailsSent),
		EmailsFailed:     int32(emailsFailed),
		FailedRecipients: failedRecipients,
	}, nil
}

// CallAPI handles API integration jobs
func (s *ExecutorService) CallAPI(ctx context.Context, req *APIJobRequest) (*APIJobResponse, error) {
	log.Printf("Calling API for job %s: %s %s", req.JobId, req.Method, req.Url)

	startTime := time.Now()

	// Create HTTP client with timeout
	client := &http.Client{
		Timeout: time.Duration(req.Timeout) * time.Second,
	}

	// Create HTTP request
	httpReq, err := http.NewRequestWithContext(ctx, req.Method, req.Url, strings.NewReader(req.Body))
	if err != nil {
		return &APIJobResponse{
			JobId:   req.JobId,
			Success: false,
			Error:   err.Error(),
		}, nil
	}

	// Add headers
	for key, value := range req.Headers {
		httpReq.Header.Set(key, value)
	}

	// Execute request with retry logic
	var resp *http.Response
	retries := int(req.Retries)
	if retries == 0 {
		retries = 1
	}

	for i := 0; i < retries; i++ {
		resp, err = client.Do(httpReq)
		if err == nil {
			break
		}
		if i < retries-1 {
			time.Sleep(time.Second * time.Duration(i+1)) // Exponential backoff
		}
	}

	if err != nil {
		return &APIJobResponse{
			JobId:      req.JobId,
			Success:    false,
			Error:      err.Error(),
			DurationMs: int32(time.Since(startTime).Milliseconds()),
		}, nil
	}
	defer resp.Body.Close()

	// Read response
	bodyBytes, _ := io.ReadAll(resp.Body)

	// Prepare response headers
	respHeaders := make(map[string]string)
	for key, values := range resp.Header {
		respHeaders[key] = strings.Join(values, ", ")
	}

	return &APIJobResponse{
		JobId:           req.JobId,
		Success:         resp.StatusCode >= 200 && resp.StatusCode < 300,
		StatusCode:      int32(resp.StatusCode),
		ResponseBody:    string(bodyBytes),
		ResponseHeaders: respHeaders,
		DurationMs:      int32(time.Since(startTime).Milliseconds()),
	}, nil
}

// RunScript handles custom script execution
func (s *ExecutorService) RunScript(ctx context.Context, req *ScriptJobRequest) (*ScriptJobResponse, error) {
	log.Printf("Running script for job %s: %s", req.JobId, req.ScriptType)

	// Create temporary script file
	tmpFile, err := os.CreateTemp("", fmt.Sprintf("script_%s_*.%s", req.JobId, s.getScriptExtension(req.ScriptType)))
	if err != nil {
		return &ScriptJobResponse{
			JobId:   req.JobId,
			Success: false,
			Error:   err.Error(),
		}, nil
	}
	defer os.Remove(tmpFile.Name())

	// Write script content
	if _, err := tmpFile.WriteString(req.ScriptContent); err != nil {
		return &ScriptJobResponse{
			JobId:   req.JobId,
			Success: false,
			Error:   err.Error(),
		}, nil
	}
	tmpFile.Close()

	// Make executable
	os.Chmod(tmpFile.Name(), 0755)

	// Prepare command
	var cmd *exec.Cmd
	switch strings.ToLower(req.ScriptType) {
	case "bash":
		cmd = exec.CommandContext(ctx, "bash", tmpFile.Name())
	case "python":
		cmd = exec.CommandContext(ctx, "python3", tmpFile.Name())
	case "node":
		cmd = exec.CommandContext(ctx, "node", tmpFile.Name())
	default:
		return &ScriptJobResponse{
			JobId:   req.JobId,
			Success: false,
			Error:   fmt.Sprintf("unsupported script type: %s", req.ScriptType),
		}, nil
	}

	// Add arguments
	if len(req.Args) > 0 {
		cmd.Args = append(cmd.Args, req.Args...)
	}

	// Set environment variables
	cmd.Env = os.Environ()
	for key, value := range req.Env {
		cmd.Env = append(cmd.Env, fmt.Sprintf("%s=%s", key, value))
	}

	// Execute with timeout
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(req.Timeout)*time.Second)
	defer cancel()

	// Capture output
	stdout, _ := cmd.Output()
	stderr := ""
	exitCode := 0

	if err := cmd.Run(); err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			stderr = string(exitErr.Stderr)
			exitCode = exitErr.ExitCode()
		} else {
			return &ScriptJobResponse{
				JobId:   req.JobId,
				Success: false,
				Error:   err.Error(),
			}, nil
		}
	}

	return &ScriptJobResponse{
		JobId:    req.JobId,
		Success:  exitCode == 0,
		Stdout:   string(stdout),
		Stderr:   stderr,
		ExitCode: int32(exitCode),
	}, nil
}

// Helper functions

func (s *ExecutorService) processCSV(filePath, operation string) (int, error) {
	file, err := os.Open(filePath)
	if err != nil {
		// For demo, simulate processing
		return 1000, nil
	}
	defer file.Close()

	reader := csv.NewReader(file)
	records := 0

	for {
		_, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return 0, err
		}
		records++
	}

	return records, nil
}

func (s *ExecutorService) processJSON(filePath, operation string) (int, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		// For demo, simulate processing
		return 500, nil
	}

	var jsonData []map[string]interface{}
	if err := json.Unmarshal(data, &jsonData); err != nil {
		return 0, err
	}

	return len(jsonData), nil
}

func (s *ExecutorService) sendEmailToRecipient(recipient, subject, body string) bool {
	// Simulate email sending (replace with actual SMTP)
	// For now, just log and return success
	log.Printf("Sending email to %s: %s", recipient, subject)
	time.Sleep(10 * time.Millisecond) // Simulate network delay
	return true
}

func (s *ExecutorService) getScriptExtension(scriptType string) string {
	switch strings.ToLower(scriptType) {
	case "bash":
		return "sh"
	case "python":
		return "py"
	case "node":
		return "js"
	default:
		return "txt"
	}
}
