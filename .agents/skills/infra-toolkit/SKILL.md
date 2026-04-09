---
name: Infrastructure & DevOps Toolkit
description: 提供 Docker、Nginx、docker-compose 及部署相關的知識庫，支援 Progressive Disclosure 按需載入各類基礎設施最佳實踐與審計清單。
---

# Infrastructure & DevOps Toolkit

## 概述
本 Skill 為 TauX 基礎設施 Agent 套件的知識庫，包含 Dockerfile、Nginx、docker-compose 的最佳實踐參考文件及部署審計清單。

## 載入規則 (Progressive Disclosure)

Agent 應根據使用者 prompt 中偵測到的 **關鍵字** 按需載入對應資源，而非預載全部文件。

### 資源映射表

| 偵測關鍵字 | 載入資源 | 擷取範圍 |
|-----------|---------|---------|
| `Dockerfile`, `multi-stage`, `distroless`, `CGO`, `builder` | `assets/dockerfile-best-practices.md` | 對應章節 |
| `nginx`, `CSP`, `HSTS`, `proxy`, `security headers`, `upstream` | `assets/nginx-hardening-reference.md` | 對應章節 |
| `docker-compose`, `compose`, `services`, `volumes`, `ports` | `assets/docker-compose-patterns.md` | 對應章節 |
| `deploy`, `部署`, `checklist`, `audit`, `審計`, `review` | `assets/deployment-checklist.md` | 相關類別 |

### 規則
1. **一次一份**: 同時間只載入一份資源文件，避免 context bloat
2. **Section Only**: 擷取請求相關的章節，不載入整份文件
3. **明確卸載**: 切換主題時，聲明前一份資源已不在 context 中
4. **TauX 特化**: 所有範例與配置均基於 TauX 專案的實際架構 (Go 1.24 + Gin, Distroless, Nginx reverse proxy)

## 目錄結構

```
skills/infra-toolkit/
├── SKILL.md                              ← 本文件
└── assets/
    ├── dockerfile-best-practices.md      ← Dockerfile 最佳實踐
    ├── nginx-hardening-reference.md      ← Nginx 安全與效能配置
    ├── docker-compose-patterns.md        ← docker-compose 設計模式
    └── deployment-checklist.md           ← 8 大類部署審計清單
```
