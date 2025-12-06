.PHONY: proto build run clean

proto:
	protoc -I=../shared/proto \
		--go_out=. --go_opt=paths=source_relative \
		--go-grpc_out=. --go-grpc_opt=paths=source_relative \
		executor.proto

build:
	go build -o bin/executor .

run:
	go run .

dev:
	air

clean:
	rm -rf bin/

deps:
	go mod download
	go mod tidy

test:
	go test -v ./...

docker-build:
	docker build -t karmayogi-executor:latest .

docker-run:
	docker run -p 50052:50052 --env-file ../../.env karmayogi-executor:latest
