# Build stage
FROM golang:1.24-alpine AS builder

WORKDIR /app

# Install required system dependencies for building (if any)
# RUN apk add --no-cache git

# Copy go mod and sum files
COPY go.mod go.sum ./

# Download all dependencies. Dependencies will be cached if the go.mod and go.sum files are not changed
RUN go mod download

# Copy the source code
COPY . .

# Build the application
# CGO_ENABLED=0 disables Cgo, which is required for a static build
# GOOS=linux ensures we build for Linux
RUN CGO_ENABLED=0 GOOS=linux go build -o main .

# Run stage
FROM alpine:latest

WORKDIR /app

# Copy the binary from the builder stage
COPY --from=builder /app/main .

# Copy static files and templates
COPY --from=builder /app/static ./static
COPY --from=builder /app/templates ./templates

# Create a non-root user
RUN adduser -D -g '' appuser
USER appuser

# Expose the port the app runs on
EXPOSE 8080

# Command to run the executable
CMD ["./main"]
