# TauX 拓思科技有限公司 - 官方網站

![TauX Logo](static/taux-logo-light.png)

**Code the Future - 用科技創造未來**

TauX 拓思科技有限公司專注於 AI Smart Work 與 GEO (Generative Engine Optimization)，運用 AI 技術為企業打造全方位數位轉型解決方案。

## 🚀 關於我們

我們是高雄在地的專業團隊，致力於為台灣企業提供最優質的數位化服務。結合軟體開發專業與創意行銷策略，為您的品牌創造數位時代的競爭優勢。

### 🎯 核心服務

- **💻 軟體平台開發** - 企業級 Web 應用、APP、SaaS 平台開發
- **🎬 短影片製作與策略** - TikTok、Instagram Reels、YouTube Shorts 內容製作
- **📈 數位行銷整合** - 社群媒體經營、SEO、廣告投放策略
- **🤖 AI 智能解決方案** - 智能客服、數據分析、自動化工具
- **⚙️ 系統整合與自動化** - CRM/ERP 系統串接、工作流程優化

## 🛠️ 技術規格

本專案採用 Go (Gin Framework) 後端搭配 TailwindCSS SSR 前端架構：

- **Backend**: Go 1.24+, Gin Web Framework
- **Frontend**: HTML5 Templates (SSR), TailwindCSS 3.4
- **Infrastructure**: Docker (Distroless/nonroot), Docker Compose, Nginx Proxy + Acme Companion (Auto SSL)
- **Design**: Premium Tech Aesthetic, Glassmorphism, Dark Mode Optimized
- **Security**: Defense-in-depth Security Headers (Go + Nginx), Hardened CSP, Distroless Container

## 📁 專案結構

```
taux-dev/
├── main.go                     # Go 伺服器入口 (含 Security Headers Middleware)
├── templates/                  # HTML 模板
│   ├── index.html              # 首頁
│   ├── header.html             # 共用頁首
│   ├── footer.html             # 共用頁尾
│   ├── geo-guide.html          # GEO 指南
│   ├── ai-smart-work.html      # AI Smart Work
│   ├── data-governance.html    # 資料治理
│   ├── what-is-llms-txt.html   # LLMs.txt 介紹
│   ├── what-is-prompt-injection.html # Prompt Injection 安全
│   ├── agent-prompting-guide.html    # Agent Prompting 指南
│   ├── claude-skills-guide.html      # Claude Skills 實戰指南
│   ├── building.html           # Building in Public
│   ├── about.html              # 關於我們
│   ├── privacy-policy.html     # 隱私權政策
│   ├── terms-of-service.html   # 服務條款
│   ├── 404.html                # 自定義 404 頁面
│   └── 500.html                # 自定義 500 錯誤頁面
├── static/                     # 靜態資源
│   ├── css/                    # 編譯後的 CSS
│   ├── js/                     # 前端 JavaScript
│   └── img/                    # 圖片資源
├── src/                        # 前端原始碼 (CSS input)
├── .agents/                    # AI 協作體系
│   ├── AGENTS.md               # 核心系統提示詞
│   ├── agents/                 # 7 大部門專家代理
│   ├── skills/                 # 開發技能 (SOPs)
│   └── workflows/              # 自動化工作流程
├── tailwind.config.js          # Tailwind 設定
├── Dockerfile                  # Go 應用容器設定 (Distroless + nonroot)
├── docker-compose.yml          # Docker Compose 基礎設定
├── docker-compose.dev.yml      # 開發環境部署設定
├── docker-compose.prod.yml     # 生產環境部署設定 (Nginx Proxy + Acme)
└── nginx.conf                  # Nginx 設定 (Security Headers + Hardened CSP)
```

## 🤖 AI 協作體系

本專案採用基於 Google Cloud Tech **《5 Agent Skill Design Patterns》** 的 AI 輔助開發架構：

### 設計模式
所有 Agent 皆嚴格實作以下 5 種模式：
1. **Tool Wrapper** - 將領域知識封裝為按需載入的 Skills
2. **Generator** - 使用標準模板確保產出一致性
3. **Reviewer** - 分離生成與驗證，使用 Checklist 自我審查
4. **Inversion** - 先蒐集必要上下文再開始執行 (Ask-before-Code)
5. **Pipeline** - 強制多階段工作流 (Diagnosis → Execution → Validation)

### 核心文件
- **[AGENTS.md](.agents/AGENTS.md)** - Agent 核心系統提示詞與行為準則，定義 7 大部門、34+ 跨職能角色
- **[SKILL.md](.agents/skills/taux-core/SKILL.md)** - 開發、測試與部署的 SOPs & Checklists
- **[NOTES.md](NOTES.md)** - 專案長期記憶、技術決策紀錄

### 代理部門
| 部門 | 角色數 | 職責範圍 |
|---|---|---|
| Engineering | 6 | 前端、後端、行動裝置、AI、DevOps、原型開發 |
| Product | 3 | 趨勢研究、回饋統整、Sprint 優先排序 |
| Marketing | 7 | 社群經營 (TikTok/IG/Twitter/Reddit)、ASO、成長駭客 |
| Design | 5 | UI/UX、品牌守護、視覺敘事、趣味注入 |
| Project Management | 3 | 實驗追蹤、專案出貨、製作統籌 |
| Studio Operations | 5 | 客服、分析、基礎設施、法遵、財務 |
| Testing | 5 | 工具評估、API 測試、效能測試、資安測試 |

## 🔒 安全機制

### 應用層安全 (Go Middleware)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(), microphone=(), camera=()`

### 基礎設施安全 (Nginx)
- Hardened Content-Security-Policy (無 `unsafe-inline` script-src)
- `Strict-Transport-Security` (HSTS)
- `frame-ancestors 'none'`
- `server_tokens off`

### 容器安全 (Docker)
- Google Distroless `static-debian12:nonroot` 基底映像
- 非 root 使用者 (UID 65532) 運行
- 多階段建置，僅部署編譯產物
- CGO_ENABLED=0 純靜態編譯

## 🚀 快速開始

### 方法一：使用 Docker (推薦 - 自動 SSL)

```bash
# 啟動服務 (App + Nginx Proxy + Acme Companion)
# 系統將自動申請並展期 Let's Encrypt 憑證
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build

# 訪問網站
# https://taux.io (Production)
# http://localhost (Local Development)
```

### 方法二：本地開發

1. **安裝依賴**
   ```bash
   npm install        # 安裝 Tailwind 依賴
   go mod download    # 下載 Go 模組
   ```

2. **啟動 CSS 監聽 (Terminal 1)**
   ```bash
   npm run watch
   ```

3. **啟動 Go 伺服器 (Terminal 2)**
   ```bash
   export PORT=8080
   go run main.go
   ```

4. **訪問**
   open http://localhost:8080

## 🎨 功能特色

### 📱 響應式設計
- 自適應各種螢幕尺寸
- 移動裝置優先設計
- 觸控友好的使用者介面

### 🔍 SEO & GEO 優化
- 完整的 Meta 標籤配置
- 結構化數據 (Schema.org: Organization, FAQPage, BreadcrumbList)
- 多語言支援 (zh-TW, en)
- 社群媒體優化 (Open Graph, Twitter Cards)
- LLMs.txt 支援 AI 搜尋引擎

### ⚡ 效能優化
- 圖片延遲載入
- 字體預加載
- CSS/JS 最佳化
- 快取策略

## 🔧 開發指南

### 編輯內容
**Developers**: Please refer to `AGENTS.md` and `SKILL.md` for detailed development workflows and standards.

### 新增頁面
1. 在 `templates/` 目錄下創建新的 HTML 檔案 (參考 `templates/index.html`)
2. 在 `main.go` 中註冊新的 GET 路由
3. 更新 `header.html` (PC & Mobile) 與 `footer.html` 導航連結
4. 更新 `sitemap.xml`

## 🚀 部署說明

### 開發環境部署 (Development)
在本地開發時，使用以下指令來啟動服務，此設定會將網域綁定在 `localhost`：

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

### 生產環境部署 (Production)
本專案生產環境使用 `nginxproxy/acme-companion` 處理 SSL 自動化。

1. **DNS 設定**：確保網域 (A Record) 指向伺服器 IP。
2. **環境變數**：在 `docker-compose.prod.yml` 中設定 `LETSENCRYPT_EMAIL`。
3. **啟動**：
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   ```
   容器啟動後，`acme-companion` 會自動偵測 `VIRTUAL_HOST` 並與 Let's Encrypt 通訊申請/更新憑證。

## 📞 聯絡資訊

- **公司名稱**: TauX 拓思科技有限公司
- **網站**: https://taux.io
- **電子郵件**: hello@taux.io
- **電話**: 07-6211033
- **地址**: 高雄市岡山區文賢路 57 號 2 樓

## 📝 授權條款

© 2026 TauX 拓思科技有限公司. 保留所有權利.

---

**Code the Future - 用科技創造未來** 🚀