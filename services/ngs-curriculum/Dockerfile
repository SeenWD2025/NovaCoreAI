FROM golang:1.21-alpine AS builder

WORKDIR /app

# Copy everything including vendor directory
COPY . .

# Build the application using vendored dependencies
RUN CGO_ENABLED=0 GOOS=linux go build -mod=vendor -a -installsuffix cgo -o main .

# Final stage - use scratch for minimal size since we have static binary
FROM scratch

# Copy CA certificates from builder
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/main .

EXPOSE 9000

CMD ["./main"]
