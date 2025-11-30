# Stage 1: Build frontend assets
FROM node:18-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install
COPY . .
RUN npm run build:css

# Stage 2: Build the Go application
FROM golang:1.24-alpine AS go-builder
WORKDIR /app

COPY --from=builder /app /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

# Stage 3: Create the final production image
FROM alpine:latest
WORKDIR /app

COPY --from=go-builder /app/main .
COPY --from=builder /app/static ./static
COPY --from=builder /app/templates ./templates

EXPOSE 8080
ENTRYPOINT ["./main"]
