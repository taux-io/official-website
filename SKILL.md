---
name: TauX 開發技能
description: TauX 網站開發、測試與部署的通用工作流程。
---

# TauX 開發技能 (SKILL.md)

本文件定義 AI Agent 在此存儲庫工作的標準作業程序 (SOP)。

## 1. 環境設置與執行

### 本地開發 (快速)
- **後端**: `go run main.go`
  - 運行於: `http://localhost:8080`
- **前端**: `npm run watch`
  - 監聽 `src/input.css` 並重新構建至 `static/css/styles.min.css`。

### 生產環境模擬 (Docker)
- **指令**: `docker compose up -d --build`
- **網址**: `http://localhost` (透過埠 80 上的 Nginx)
- **日誌**: `docker compose logs -f`
- **重新構建**: 如果變更了 `go.mod` 或依賴項，請務必包含 `--build` 參數。

## 2. 標準任務

### 新增頁面
1.  **建立模板**: 複製 `templates/index.html` 或其他現有頁面至 `templates/new-page.html`。
2.  **新增路由**: 在 `main.go` 中新增 GET 路由：
    ```go
    r.GET("/new-page", func(c *gin.Context) {
        c.HTML(http.StatusOK, "new-page.html", nil)
    })
    ```
3.  **更新導航**: 在以下檔案中新增連結：
    - `templates/header.html` (桌面版與手機版區塊)
    - `templates/footer.html`

### 修改樣式
1.  **編輯 HTML**: 直接在 `templates/*.html` 中使用 Tailwind 工具類別。
2.  **編輯 CSS**: 如果需要自定義 CSS，請編輯 `src/input.css`。
3.  **驗證**: 執行 `npm run build:css` 或 `npm run watch` 確保 `static/css/styles.min.css` 已更新。

### 安全檢查
- **標頭**: 透過 Nginx 配置或瀏覽器開發工具驗證。
- **Docker**: 確保 `USER appuser` 位於 Dockerfile 的最後。
- **相依性**: 不定期執行 `npm audit`。

## 3. 故障排除

### "Template Not Found" (找不到模板)
- 檢查 `main.go` 是否有 `r.LoadHTMLGlob("templates/*.html")`。
- 確保檔案確實存在於 `templates/` 目錄中。

### "Styles Not Updating" (樣式未更新)
- 瀏覽器快取？請強制重新整理 (Cmd+Shift+R)。
- 有執行 `npm run build:css` 嗎？
- 檢查 `static/css/styles.min.css` 的時間戳記。

### 手機版選單問題
- 手機版選單遮罩層 (Overlay) 的 z-index 必須高於內容。
- **修復方法**: 使用 `z-index: 9999 !important` 並盡可能將 `mobileMenuOverlay` 移動為 `body` 的直接子元素 (或移出 `nav` 標籤之外)。

## 4. 品質保證 (QA) 與驗證檢查清單

所有新功能或頁面上線前，**必須** 通過以下檢查：

### A. 技術驗證
- [ ] **HTML 結構**: 無未閉合的標籤，ID 唯一。
- [ ] **手機版響應式**:
  - [ ] 漢堡選單 (Hamburger Menu) 可正常開關。
  - [ ] 選單遮罩層 (Overlay) 背景為實色且 `z-index` 足夠高 (蓋過內容)。
  - [ ] 文字無溢出螢幕邊緣。
- [ ] **Console 錯誤**: 瀏覽器開發者工具無紅字錯誤。
- [ ] **連結檢查**: 所有內部連結與外部連結皆有效 (無 404)。
- [ ] **導航一致性**: Header, Footer 與 Mobile Menu 的連結名稱與順序需保持一致。

### B. GEO 與 SEO 驗證
- [ ] **Meta 標籤**: `templates/header.html` 或頁面中包含唯一的 `title` 與 `description`。
- [ ] **結構化資料 (JSON-LD)**:
  - [ ] 包含 `BreadcrumbList` (麵包屑導航)。
  - [ ] 文章頁面包含 `Article` Schema。
  - [ ] 驗證 JSON 語法正確 (無結尾逗號錯誤)。
- [ ] **語意化標籤**: 正確使用 `<h1>` (每頁一個), `<h2>`, `<h3>` 建立內容層級。
- [ ] **URL 結構**: 使用短橫線分隔的小寫英文 (如 `/agent-prompting-guide`)。

### C. 內容驗證
- [ ] **語調一致性**: 符合 "Premium Tech" (專業、科技感、自信)。
- [ ] **無佔位符**: 確保無 Lorem Ipsum 或 "待補充" 字樣。
- [ ] **繁體中文**: 確保使用台灣繁體中文慣用語 (如 "資訊" 而非 "信息")。

