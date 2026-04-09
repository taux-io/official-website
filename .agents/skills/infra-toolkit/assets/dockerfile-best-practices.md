# Dockerfile 最佳實踐參考

> 本文件為 TauX 專案的 Dockerfile 設計規範。所有範例均基於 Go 1.24 + Gin + Distroless 架構。

## 1. Multi-Stage Build

### 原則
- **Build stage**: 使用完整 SDK image (e.g., `golang:1.24-alpine`) 編譯
- **Run stage**: 使用最小化 image (e.g., `gcr.io/distroless/static-debian12:nonroot`) 執行
- 目的：將最終映像大小控制在 ~10MB 以下，且不包含編譯工具

### TauX 標準模式
```dockerfile
# Build stage
FROM golang:1.24-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

# Run stage
FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=builder --chown=nonroot:nonroot /app/main .
COPY --from=builder --chown=nonroot:nonroot /app/static ./static
COPY --from=builder --chown=nonroot:nonroot /app/templates ./templates
USER nonroot:nonroot
EXPOSE 8080
CMD ["/app/main"]
```

## 2. 靜態編譯

### 關鍵旗標
| 旗標 | 用途 |
|------|------|
| `CGO_ENABLED=0` | 禁用 CGO，確保純 Go 靜態編譯 |
| `GOOS=linux` | 目標作業系統 |
| `-a` | 強制重新編譯所有套件 |
| `-installsuffix cgo` | 使用獨立的套件安裝目錄 |

### 為何必須靜態編譯？
Distroless 映像 **不含** libc、sh、bash 等任何系統程式庫。若使用動態連結，binary 將無法執行。

## 3. 安全原則

### Nonroot 執行
- 使用 `gcr.io/distroless/static-debian12:nonroot` 標籤
- `COPY --chown=nonroot:nonroot` 確保檔案擁有者正確
- `USER nonroot:nonroot` 明確指定 UID 65532
- **禁止**: `USER root`、空 `USER` 指令

### 敏感檔案排除
必須在 `.dockerignore` 中排除：
```
.git
.agents
.env*
*.md
!README.md
node_modules
src/
```

## 4. Layer Cache 最佳化

### 原則：從變動最少到最多
```dockerfile
# 1. 依賴檔 (rarely changes)
COPY go.mod go.sum ./
RUN go mod download

# 2. 原始碼 (frequently changes)
COPY . .
RUN go build ...
```

### 反模式 ❌
```dockerfile
# Bad: 每次原始碼變動都會重新下載依賴
COPY . .
RUN go mod download && go build ...
```

## 5. Health Check

### 建議配置
```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD ["/app/main", "healthcheck"] || exit 1
```

> ⚠️ 注意：Distroless 不含 `curl` 或 `wget`，需在 Go 程式中內建 healthcheck endpoint (`/health`)。

## 6. 環境變數

### 標準環境變數
| 變數 | 用途 | 預設值 |
|------|------|--------|
| `GIN_MODE` | Gin 運行模式 | `release` (production) |
| `PORT` | 監聽埠 | `8080` |

### 注意事項
- **禁止** 在 Dockerfile 中 hardcode secrets
- 使用 `docker-compose.yml` 的 `environment` 或 `.env` 檔案傳入
- Production 應使用 Docker Secrets 或 Cloud Secret Manager

## 7. 常見問題

### Q: 為何不用 Alpine 作為 run stage？
A: Distroless 更安全（零 shell、零套件管理器），攻擊面最小化。

### Q: 編譯失敗怎麼辦？
A: 檢查 `CGO_ENABLED=0` 是否設定，部分套件 (如 `sqlite3`) 需要 CGO，需評估替代方案。

### Q: 映像大小過大？
A: 確認 `.dockerignore` 排除 `node_modules`, `.git`, `src/`。最終映像應 < 20MB。
