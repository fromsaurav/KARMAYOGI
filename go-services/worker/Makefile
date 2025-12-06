.PHONY: proto build run clean

# Generate protobuf files
proto:
	protoc -I=../shared/proto \
		--go_out=. --go_opt=paths=source_relative \
		--go-grpc_out=. --go-grpc_opt=paths=source_relative \
		worker.proto

# Build the worker service
build:
	go build -o bin/worker .

# Run the worker service
run:
	go run .

# Run with hot reload (requires air: go install github.com/cosmtrek/air@latest)
dev:
	air

# Clean build artifacts
clean:
	rm -rf bin/

# Download dependencies
deps:
	go mod download
	go mod tidy

# Run tests
test:
	go test -v ./...

# Docker build
docker-build:
	docker build -t karmayogi-worker:latest .

# Docker run
docker-run:
	docker run -p 50051:50051 --env-file ../../.env karmayogi-worker:latest
