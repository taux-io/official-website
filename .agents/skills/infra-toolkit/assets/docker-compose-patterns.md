# Docker Compose 設計模式參考

> 本文件為 TauX 專案的 docker-compose 配置規範，涵蓋開發與生產環境差異。

## 1. TauX 服務架構

```
┌─────────────────┐     ┌─────────────────┐
│   nginx:alpine  │────▶│   taux-app      │
│   Port 80       │     │   Port 8080     │
│   (Reverse Proxy)│    │   (Go/Gin)      │
└─────────────────┘     └─────────────────┘
```

### 標準 docker-compose.yml
```yaml
version: '3.8'

services:
  app:
    build: .
    container_name: taux-app
    restart: always
    expose:
      - "8080"
    environment:
      - GIN_MODE=release
    healthcheck:
      test: ["CMD", "/app/main", "healthcheck"]
      interval: 30s
      timeout: 3s
      retries: 3

  nginx:
    image: nginx:alpine
    container_name: taux-website
    restart: always
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./static/502.html:/usr/share/nginx/html/errors/502.html:ro
      - ./static/503.html:/usr/share/nginx/html/errors/503.html:ro
    depends_on:
      app:
        condition: service_healthy
```

## 2. expose vs ports

| 指令 | 說明 | 使用場景 |
|------|------|---------|
| `expose` | 僅在 Docker 網路內部公開 | 後端服務 (app → nginx 內部通訊) |
| `ports` | 映射到 host | 前端入口 (nginx → 外部存取) |

### 規則
- `app` 服務使用 `expose`（不直接對外）
- `nginx` 服務使用 `ports`（對外入口）
- 開發環境可額外添加 `ports: "8080:8080"` 到 app 直接存取

## 3. 開發 vs 生產配置

### 開發環境 (docker-compose.dev.yml)
```yaml
version: '3.8'

services:
  app:
    build: .
    container_name: taux-app-dev
    ports:
      - "8080:8080"    # 直接存取後端
    environment:
      - GIN_MODE=debug
    volumes:
      - ./templates:/app/templates:ro    # 熱載入模板
      - ./static:/app/static:ro          # 熱載入靜態資源

  nginx:
    image: nginx:alpine
    container_name: taux-website-dev
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./static/502.html:/usr/share/nginx/html/errors/502.html:ro
      - ./static/503.html:/usr/share/nginx/html/errors/503.html:ro
    depends_on:
      - app
```

### 生產環境差異
| 維度 | 開發 | 生產 |
|------|------|------|
| `GIN_MODE` | `debug` | `release` |
| app `ports` | `8080:8080` | 僅 `expose` |
| Volume mounts | templates/static 掛載 | 無（baked into image） |
| `restart` | 可選 | `always` |
| Health check | 可選 | **必要** |
| Logging | default | json-file + max-size |

## 4. Volume 掛載原則

### 安全規則
- 使用 `:ro` (read-only) 限制寫入
- **禁止** 掛載 Docker socket (`/var/run/docker.sock`)
- **禁止** 掛載 `.env` 或 secrets 檔案到容器中（應使用環境變數）

### 合法掛載
```yaml
volumes:
  - ./nginx.conf:/etc/nginx/nginx.conf:ro    # ✅ Read-only config
  - ./static/502.html:/usr/share/nginx/html/errors/502.html:ro  # ✅ Fallback pages
```

## 5. 網路隔離

### 建議：Internal Network
```yaml
services:
  app:
    networks:
      - internal

  nginx:
    networks:
      - internal
      - external

networks:
  internal:
    internal: true    # 不對外
  external:
    driver: bridge
```

## 6. 日誌管理

### 生產日誌配置
```yaml
services:
  app:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## 7. depends_on 與 Health Check

### 基本 (順序啟動)
```yaml
depends_on:
  - app
```

### 進階 (等待健康)
```yaml
depends_on:
  app:
    condition: service_healthy
```

> ⚠️ `condition: service_healthy` 需要 app 服務定義 `healthcheck`。

## 8. 常見問題

### Q: 為何生產不掛載 templates?
A: 安全性。生產映像應包含所有必要檔案 (baked in)，避免 host 檔案被篡改。

### Q: docker-compose.yml 使用什麼版本？
A: `version: '3.8'`。注意 Docker Compose V2 已淘汰 `version` 欄位，但保留以向後相容。

### Q: 如何強制重建？
```bash
docker compose build --no-cache && docker compose up -d
```
