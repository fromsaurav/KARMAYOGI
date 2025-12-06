# Build stage
FROM golang:1.22-alpine AS builder

RUN apk add --no-cache git make protobuf-dev

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o executor .

# Runtime stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates python3 nodejs bash

WORKDIR /root/

COPY --from=builder /app/executor .

EXPOSE 50052

CMD ["./executor"]
