package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
)

const (
	defaultPort       = "50051"
	defaultWorkerPool = 1000
)

type Config struct {
	Port          string
	DatabaseURL   string
	RedisHost     string
	RedisPort     string
	RedisPassword string
	WorkerPoolSize int
}

func loadConfig() *Config {
	return &Config{
		Port:          getEnv("WORKER_PORT", defaultPort),
		DatabaseURL:   getEnv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/karmayogi"),
		RedisHost:     getEnv("REDIS_HOST", "localhost"),
		RedisPort:     getEnv("REDIS_PORT", "6379"),
		RedisPassword: getEnv("REDIS_PASSWORD", ""),
		WorkerPoolSize: getEnvInt("WORKER_POOL_SIZE", defaultWorkerPool),
	}
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if value := os.Getenv(key); value != "" {
		var intVal int
		fmt.Sscanf(value, "%d", &intVal)
		return intVal
	}
	return fallback
}

func main() {
	config := loadConfig()

	// Initialize database connection
	dbPool, err := initDatabase(config.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer dbPool.Close()

	// Initialize Redis connection
	redisClient := initRedis(config.RedisHost, config.RedisPort, config.RedisPassword)
	defer redisClient.Close()

	// Create worker pool
	workerPool := NewWorkerPool(config.WorkerPoolSize, dbPool, redisClient)

	// Create gRPC server
	grpcServer := grpc.NewServer()

	// Create and register worker service
	workerService := NewWorkerService(workerPool, dbPool, redisClient)
	RegisterWorkerServiceServer(grpcServer, workerService)

	// Enable reflection for grpcurl
	reflection.Register(grpcServer)

	// Start gRPC server
	listener, err := net.Listen("tcp", fmt.Sprintf(":%s", config.Port))
	if err != nil {
		log.Fatalf("Failed to listen: %v", err)
	}

	// Start worker pool
	workerPool.Start()

	log.Printf("🚀 Go Worker Service started on port %s", config.Port)
	log.Printf("📊 Worker pool size: %d goroutines", config.WorkerPoolSize)
	log.Printf("🔗 Database: Connected")
	log.Printf("🔗 Redis: Connected")

	// Graceful shutdown
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)
		<-sigCh

		log.Println("🛑 Shutting down gracefully...")

		// Stop accepting new jobs
		workerPool.Stop()

		// Stop gRPC server
		grpcServer.GracefulStop()

		log.Println("✅ Shutdown complete")
		os.Exit(0)
	}()

	// Serve
	if err := grpcServer.Serve(listener); err != nil {
		log.Fatalf("Failed to serve: %v", err)
	}
}

func initDatabase(databaseURL string) (*pgxpool.Pool, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse database URL: %w", err)
	}

	// Connection pool settings
	config.MaxConns = 100
	config.MinConns = 10
	config.MaxConnLifetime = time.Hour
	config.MaxConnIdleTime = 30 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("failed to create connection pool: %w", err)
	}

	// Test connection
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return pool, nil
}

func initRedis(host, port, password string) *redis.Client {
	client := redis.NewClient(&redis.Options{
		Addr:         fmt.Sprintf("%s:%s", host, port),
		Password:     password,
		DB:           0,
		PoolSize:     100,
		MinIdleConns: 10,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}

	return client
}
