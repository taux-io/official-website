# TauX 專案筆記與背景記憶

## 專案概覽
TauX (拓思科技) 是一家專注於 AI 驅動智能辦公解決方案、數據治理與生成式引擎優化 (GEO) 的 "GEO of Things" 科技公司。

## 架構
- **後端**: Go (Golang) 1.24+ 使用 Gin 框架。
- **前端**: 伺服器端渲染 (SSR) HTML 模板，搭配 TailwindCSS v3.4。
- **基礎設施**: Docker (nginx-proxy + acme-companion) 實現自動化 SSL 管理。
- **設計系統**: "Premium Tech" 美學 (深空黑 `#030305`, 霓虹青 `#00F0FF`, 紫色 `#7000FF`)。

## 關鍵決策與慣例
- **模板結構**: `templates/` 資料夾包含 HTML。`header.html` 與 `footer.html` 為局部模板 (partials)。
- **靜態檔案**: 服務於 `/static`。CSS 由 `src/input.css` 構建至 `static/css/styles.min.css`。
- **Docker 構建**: 多階段構建 (Golang builder -> Alpine runner)。
- **Tailwind**: 用於所有樣式。配置於 `tailwind.config.js`。深色模式以類別控制，但預設為深色。
- **SSL**: 使用 `nginxproxy/acme-companion`。不需要手動執行 certbot。確保 `docker-compose.prod.yml` 中的環境變數 (`VIRTUAL_HOST`, `LETSENCRYPT_HOST`) 正確。

## 常見問題與修復
- **手機版選單透明度問題**: 玻璃擬態效果 (`backdrop-blur`) 在手機上導致可讀性問題。修復方法是在 `header.html` 中的手機版選單遮罩層強制加上實色背景 (`#030305`) 與 `!important`。
- **背景圖片**: 最初因構建問題遺失。修復方法是確保 `styles.min.css` 正確構建與載入，並在 `header.html` 中使用實色背景作為備案。
- **Go 版本**: `go.mod` 要求較新的 Go 版本。確保 Dockerfile 使用 `golang:1.24-alpine` (或相容版本)。

## 指令
- **開發**: `go run main.go` (後端), `npm run watch` (CSS)。
- **生產**: `docker compose up -d --build`。

## 近期更新
- **基礎設施遷移**: 遷移至 `nginxproxy/acme-companion`，移除手動 Certbot 腳本與複雜的 Nginx SSL 配置。
- 將整個網站從 Python/Static 重構為 Go/Gin。
- 使用 Tailwind 實作完整的 "Tech Mode" (科技風) 改版。
- 新增 "LLMs.txt" 與 "Prompt Injection" (提示注入) 頁面。
- 驗證手機版響應式設計與 Docker 部署。
- 導航選單同步: "Data Governance" 與 "Security" 連結更新。
- 手機版選單優化: 新增 "關閉 (X)" 按鈕，解決全螢幕遮罩層無法關閉的問題。
- 新增 "Building" (建置中) 頁面: 用於 "Blog", "Careers", "API" 等尚未完成的單元。
- 新增 "About", "Privacy Policy", "Terms of Service" 頁面與 "404" 錯誤頁面。
- 更新 Nginx 配置以支援自定義 404 處理。
- 修復手機版選單 "關閉 (X)" 按鈕無效問題 (更新 `script.js` 事件監聽與 CSS 層級)。
- 將 "Security" 連結名稱更新為 "Prompt Security" (Header & Footer)。
- 新增自定义 `500.html` 錯誤頁面與 Nginx 配置。
- 將導航選單中的 "Solutions" 統一名稱更正為 "Smart Work" (Header)。
- **Documentation**: 重構 `.agents/agents/` 目錄，將原先 7 個扁平化的 Agent 重新劃分為 7 大部門 (Engineering, Product, Marketing, Design, Project Management, Studio Operations, Testing)，共 38 個專業 AI 代理人架構，並同步更新了 `AGENTS.md` 與 `README.md`。
- **Documentation**: 優化 `AGENTS.md` (Agent Prompt 結構) 並同步 `SKILL.md` 與 `README.md`。
