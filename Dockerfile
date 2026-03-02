# ==========================================
# 1. Build stage (編譯階段保持不變，依舊使用 Alpine)
# ==========================================
FROM golang:1.24-alpine AS builder

WORKDIR /app

# 複製依賴檔並下載快取
COPY go.mod go.sum ./
RUN go mod download

# 複製原始碼與資源檔
COPY . .

# 進行純靜態編譯 (CGO_ENABLED=0 是關鍵，確保執行檔不需要動態連結庫)
# 加入 -a -installsuffix cgo 讓靜態編譯更徹底
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .


# ==========================================
# 2. Run stage (運行階段換成 Distroless)
# ==========================================
# 使用 Google 的 static-debian12 版本，且直接指定 nonroot 標籤
FROM gcr.io/distroless/static-debian12:nonroot

WORKDIR /app

# 複製編譯好的二進位檔與靜態資源。
# 💡 關鍵：使用 --chown=nonroot:nonroot 確保檔案擁有者正確
COPY --from=builder --chown=nonroot:nonroot /app/main .
COPY --from=builder --chown=nonroot:nonroot /app/static ./static
COPY --from=builder --chown=nonroot:nonroot /app/templates ./templates

# 明確指定使用 distroless 內建的非 Root 使用者 (UID: 65532)
USER nonroot:nonroot

EXPOSE 8080

# 執行程式 (注意：這裡不能使用 shell 形式如 CMD ./main，必須使用 JSON 陣列形式)
CMD ["/app/main"]