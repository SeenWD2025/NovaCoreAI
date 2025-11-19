FROM golang:1.21-alpine AS builder

WORKDIR /app

# Install CA certificates for HTTPS requests
RUN apk add --no-cache ca-certificates git

# Copy go mod files first for better layer caching
COPY go.mod go.sum ./

# Download modules with retry logic and increased timeout
RUN go env -w GOPROXY=https://proxy.golang.org,direct && \
    go env -w GOSUMDB=sum.golang.org && \
    go env -w GOPRIVATE="" && \
    for i in 1 2 3 4 5; do \
        echo "Attempt $i to download Go modules..." && \
        go mod download && break || \
        (echo "Download failed, retrying in 5 seconds..." && sleep 5); \
    done

# Copy source
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -o main .

# Final stage - use scratch for minimal size since we have static binary
FROM scratch

# Copy CA certificates from builder
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/main .

EXPOSE 9000

CMD ["./main"]
