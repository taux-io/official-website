# AI Agent 專案指南

## 1. 專案概覽與技術堆疊
**TauX (拓思科技)** - 致力於 AI 智能辦公與 GEO (生成式引擎優化)。

- **後端**: Go (Golang) 1.24+ 搭配 [Gin Web Framework](https://github.com/gin-gonic/gin)。
- **前端**: 伺服器端渲染 (SSR) HTML 模板 (`templates/*.html`)，樣式採用 **TailwindCSS v3.4**。
- **容器化**: Docker 與 Docker Compose (多階段構建：Go builder -> Alpine runner)。
- **反向代理**: Nginx (代理請求至 Go 應用程式)。

## 2. 架構與檔案結構

### 檔案組織
- **`main.go`**: 應用程式入口點。配置 Gin 路由、載入模板、提供靜態檔案服務。
- **`templates/`**: 使用 Go 模板語法 (`{{ template "header.html" . }}`) 的 HTML 檔案。
  - 局部模板 (Partials): `header.html`, `footer.html`.
  - 頁面: `index.html`, `geo-guide.html`, `data-governance.html` 等。
- **`src/`**: 前端構建工具的原始碼。
  - `input.css`: Tailwind CSS主要入口點 (匯入字體、自定義工具類)。
- **`static/`**: 公開對外服務於 `/static` 路徑。
  - `css/styles.min.css`: Tailwind 編譯後的輸出檔。**請勿直接編輯此檔案。**
  - `js/script.js`: 客戶端邏輯 (手機版選單、動畫)。
  - 圖片與 Favicons。
- **`NOTES.md`**: **關鍵文件**。包含專案背景、架構決策與近期修復紀錄。**請務必優先閱讀此文件。**

### 基礎設施
- **`Dockerfile`**: 多階段構建。使用 `golang:1.24-alpine` 進行構建，並使用 `alpine:latest` 運行。
- **`docker-compose.yml`**: 編排 `app` (Go) 與 `nginx` 服務。
- **`nginx.conf`**: 反向代理配置。

## 3. 開發工作流程

### 本地開發 (無 Docker)
1.  **前端 (監聽模式)**:
    ```bash
    npm run watch
    ```
    *當檔案變更時，自動編譯 `src/input.css` 至 `static/css/styles.min.css`。*

2.  **後端 (熱重載)**:
    ```bash
    go run main.go
    ```
    *伺服器運行於 `http://localhost:8080`。*

### 使用 Docker 運行 (類生產環境)
```bash
docker compose up -d --build
```
*應用程式在 Nginx 後端運行於 `http://localhost:80` (或配置的端口)。*

## 4. 程式碼標準與規範

### HTML 與模板
- 使用 Go 模板進行佈局 (`{{ define "content" }}`, `{{ template "header.html" }}`)。
- **SEO**: 確保 `meta` 標籤 (標題、描述、OG) 存在於 `header.html` 或在頁面中覆寫。
- **結構**: 使用語意化 HTML5 (`main`, `section`, `article`, `nav`)。

### CSS 與樣式 (TailwindCSS)
- **主要方法**: 直接在 HTML 中使用 Tailwind 工具類別。
- **自定義樣式**: 僅在必要時於 `src/input.css` 使用 `@layer components` 或 `@layer utilities` 添加。
- **設計 Token**:
  - 背景色: `bg-taux-bg` (#030305)
  - 強調色: `text-tech-cyan` (#00F0FF), `text-tech-purple` (#7000FF).
- **深色模式**: 預設啟用 (`html` 標籤中有 `class="dark"` )。

### JavaScript
- 僅使用原生 JS (Vanilla JS) (不使用 React/Vue/jQuery)。
- 邏輯保持在 `static/js/script.js` 中。
- 初始化請使用 `document.addEventListener('DOMContentLoaded', ...)`。

## 5. 關鍵背景與已知問題
*請參閱 `NOTES.md` 以獲取最新列表。*

- **手機版選單**: 遮罩層 (Overlay) 必須設定 `z-index: 9999 !important` 且背景必須為實色以遮蓋頁面內容。詳見 `templates/header.html`。
- **Go 版本**: 嚴格要求 Go 1.24+。
- **CSS 構建**: 如果樣式看起來不正確，請確保 `npm run build` 或 `npm run watch` 已成功更新 `static/css/styles.min.css`。
- **技能**: 關於建立頁面、部署與故障排除的詳細流程，請參閱 `SKILL.md`。
