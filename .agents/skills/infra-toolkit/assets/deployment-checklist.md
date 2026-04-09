# TauX 部署審計清單

> 本清單為 Infra Reviewer Agent 的必要審計框架。每次部署前/後均須逐項檢查。

## 使用方式
- Reviewer Agent 使用本清單的 8 大類別逐項審計
- 每個檢查項標注嚴重度：🔴 Critical / 🟡 Warning / 🟢 Pass
- 最終判決：**APPROVED** (0 🔴, ≤ 3 🟡) / **NEEDS_REVISION** (1+ 🔴 或 > 3 🟡) / **REJECTED** (5+ 🔴)

---

## 類別 1: Dockerfile 安全性

| # | 檢查項 | 嚴重度 | 說明 |
|---|--------|--------|------|
| 1.1 | Multi-stage build | 🔴 | 必須使用 builder + runtime 分離 |
| 1.2 | Distroless/minimal runtime image | 🔴 | 執行階段必須使用 distroless 或同等最小映像 |
| 1.3 | 非 root 使用者 | 🔴 | 必須使用 `USER nonroot:nonroot` |
| 1.4 | `--chown=nonroot:nonroot` on COPY | 🟡 | 複製的檔案擁有者應為 nonroot |
| 1.5 | `CGO_ENABLED=0` | 🔴 | 靜態編譯必須禁用 CGO |
| 1.6 | `.dockerignore` 存在且完整 | 🟡 | 排除 .git, .agents, node_modules, .env |
| 1.7 | 無 hardcoded secrets | 🔴 | Dockerfile 中不得有 API key、密碼等 |
| 1.8 | EXPOSE 聲明正確 | 🟢 | 應與 Go 監聽 port 一致 |
| 1.9 | CMD 使用 JSON 格式 | 🟡 | 使用 `CMD ["/app/main"]` 而非 shell form |
| 1.10 | 無不必要的套件安裝 | 🟢 | Build stage 不應 `apk add` 非必要套件 |

---

## 類別 2: Docker Compose 合規

| # | 檢查項 | 嚴重度 | 說明 |
|---|--------|--------|------|
| 2.1 | App 使用 `expose` (非 `ports`) | 🟡 | 後端不應直接對外暴露 |
| 2.2 | Nginx 使用 `ports` 對外 | 🟢 | 前端入口需映射 host port |
| 2.3 | `restart: always` (production) | 🟡 | 生產環境必須自動重啟 |
| 2.4 | Volume mounts 為 `:ro` | 🟡 | 配置檔掛載應唯讀 |
| 2.5 | 無 Docker socket 掛載 | 🔴 | 禁止掛載 `/var/run/docker.sock` |
| 2.6 | Health check 定義 | 🟡 | App 服務應定義 healthcheck |
| 2.7 | `depends_on` 正確 | 🟢 | Nginx 應依賴 app |
| 2.8 | 日誌配置 (max-size) | 🟢 | 生產應限制日誌大小 |

---

## 類別 3: Nginx 硬化

| # | 檢查項 | 嚴重度 | 說明 |
|---|--------|--------|------|
| 3.1 | `server_tokens off` | 🟡 | 隱藏 Nginx 版本 |
| 3.2 | 7 個 Security Headers 完整 | 🔴 | 見 nginx-hardening-reference.md |
| 3.3 | CSP 無 `unsafe-inline` in script-src | 🔴 | script-src 禁止 unsafe-inline |
| 3.4 | `proxy_intercept_errors on` | 🟡 | 允許自訂錯誤頁面 |
| 3.5 | Error pages 配置 (502/503) | 🟡 | 後端離線時的 fallback |
| 3.6 | Upstream 名稱使用 Docker DNS | 🟢 | `server app:8080` |

---

## 類別 4: SSL/TLS 配置

| # | 檢查項 | 嚴重度 | 說明 |
|---|--------|--------|------|
| 4.1 | HSTS header 存在 | 🔴 | `Strict-Transport-Security` |
| 4.2 | SSL 由外部 proxy 終止 | 🟢 | nginx-proxy + acme companion |
| 4.3 | HTTP → HTTPS 重定向 | 🟡 | 生產環境必須 |
| 4.4 | TLS 1.2+ only | 🟢 | 禁用 TLS 1.0/1.1 |

---

## 類別 5: 靜態資源版本化

| # | 檢查項 | 嚴重度 | 說明 |
|---|--------|--------|------|
| 5.1 | CSS 帶版本號查詢字串 | 🟡 | `styles.min.css?v=N` |
| 5.2 | JS 帶版本號查詢字串 | 🟡 | `script.js?v=N` |
| 5.3 | CSS 已經過 minify | 🟢 | `npm run build:css` 使用 `--minify` |
| 5.4 | 無 source maps 在 production | 🟢 | 避免洩露原始碼 |

---

## 類別 6: 環境變數管理

| # | 檢查項 | 嚴重度 | 說明 |
|---|--------|--------|------|
| 6.1 | `GIN_MODE=release` (production) | 🟡 | 生產環境必須 release |
| 6.2 | 無 `.env` 檔案進入 image | 🔴 | `.dockerignore` 排除 |
| 6.3 | Secrets 使用 Docker Secrets 或 env | 🟡 | 不 hardcode 在 yml |
| 6.4 | PORT 宣告一致 | 🟢 | Dockerfile EXPOSE = Go listen port |

---

## 類別 7: 日誌 & 監控

| # | 檢查項 | 嚴重度 | 說明 |
|---|--------|--------|------|
| 7.1 | 日誌輸出至 stdout/stderr | 🟢 | 容器標準做法 |
| 7.2 | 日誌大小限制 (max-size) | 🟡 | 避免磁碟爆滿 |
| 7.3 | Health endpoint 存在 (`/health`) | 🟡 | Go app 提供 |
| 7.4 | 無 debug 日誌在 production | 🟢 | GIN_MODE=release 自動關閉 |

---

## 類別 8: 回滾策略

| # | 檢查項 | 嚴重度 | 說明 |
|---|--------|--------|------|
| 8.1 | 前一版映像可用 | 🟡 | `docker images` 確認 |
| 8.2 | 回滾指令已記錄 | 🟡 | NOTES.md 或 runbook |
| 8.3 | 部署後驗證步驟 | 🟢 | curl /health + browser check |
| 8.4 | 無 volume data migration 需求 | 🟢 | 無狀態應用不需 |

---

## 審計摘要模板

```markdown
| 類別 | 結果 | 🔴 | 🟡 | 🟢 |
|------|------|----|----|-----|
| Dockerfile 安全性 | ? | ? | ? | ? |
| Docker Compose 合規 | ? | ? | ? | ? |
| Nginx 硬化 | ? | ? | ? | ? |
| SSL/TLS 配置 | ? | ? | ? | ? |
| 靜態資源版本化 | ? | ? | ? | ? |
| 環境變數管理 | ? | ? | ? | ? |
| 日誌 & 監控 | ? | ? | ? | ? |
| 回滾策略 | ? | ? | ? | ? |

**整體評級**: ?
**Verdict**: APPROVED / NEEDS_REVISION / REJECTED

**Action Items**:
1. 🔴 [Category]: [Finding]
2. 🟡 [Category]: [Finding]
```
