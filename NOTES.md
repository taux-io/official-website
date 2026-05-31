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
- **Docker 構建**: 多階段構建 (Golang builder -> Distroless static runner)。安全、無 Shell 且極小化的 Image。
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
- **SEO/GEO 專案優化**: 導入普林斯頓 9 大 GEO 方法至 `geo-guide.html`（增添論文引用、統計數據與專家引言以強化 E-E-A-T 權威性）；修正所有模版中的 JSON-LD Schema，將舊有的 `.html` 結尾路徑替換為規範 canonical URL，並將預設發行商 `logo.png` 修改為 `static/taux-logo-dark.png`，防止爬蟲 404；全面優化跨頁面超連結（例如修正為 `/#our-services`），維持無痕乾淨的 Routing。
- **DevOps/Docker 專案優化**: 
  - 新增高標準的 `.dockerignore` 檔案，徹底排除 `node_modules`（避免傳送數百 MB 垃圾快取）、`.git` 歷史庫及 Agent 內部檔案，將 Docker 構建上下文大小縮減至最小。
  - 重構 `docker-compose.prod.yml`，實施「前後端網路隔離」最佳實踐：建立外層互聯的 `taux_frontend` 與完全對內封閉的 `taux_backend`，確保後端 Go App 物理隔離於公網，安全性大幅提升。
- **UI 視覺質感與體驗優化**:
  - 重構 `src/input.css`，引入進階的多層疊加陰影（Layered Shadows）、彈性物理過渡曲線（Cubic-Bezier 0.16, 1, 0.3, 1）以及雙重環境底光（`bg-glow-radial` 和 `bg-glow-warm`），大幅提升卡片與按鈕的物理厚度與點擊回饋感。
  - 升級 `templates/header.html` 導航欄的磨砂玻璃質感（提高 blur 至 `backdrop-blur-lg`，透光率 `bg-[#191915]/80`），並全面套用 `.nav-link` 滑過動態底線。
  - 優化 `templates/index.html`：在 Hero 區塊底層疊加有機環境光暈，並為 FAQ `<details>` 可折疊元件套用流暢轉場效果與內縮邊框光陰影。
- **品牌理念與故事增強**:
  - 在首頁（`templates/index.html`）與關於我們（`templates/about.html`）中，正式融入希臘字母「**τ (tau，時間常數 Time Constant)**」之深層物理學與工程學概念，象徵企業在迎戰 AI 變革時的「響應速度」與「回歸新穩定狀態的效率」，賦予品牌極具知性與深科技（Deep Tech）底蘊的獨特定義。
- **Jules 品牌視覺風格轉型 (Jules Canvas White Pivot)**:
  - **色彩重構**: 捨棄舊有暗色系背景，全面切換至極具制度感與可信度的 **Jules Canvas White** (#fbfbfe) 偏冷白底畫布，搭配主文字 Primary Ink (#141316) 與輔助 Body Gray (#676573)。
  - **紫色代理信號色**: 將全頁核心互動點與強調邊框改為單一且明確的 **Jules Violet** (#735ce5 與 #715cd7)，出現在按鈕懸停、卡片描邊、導航底線及 Hero 時間常數符號等位置。
  - **排版微觀美學**: 遵從 Google 專業開發工具的克制美學，將主展示與標題全部統一為 **400 常規字重** 的 Google Sans 搭配，避免過度渲染的 AI 行銷粗黑字體，以嚴密秩序換取品牌信任。
  - **非對稱 CSS Grid 與 Stagger 延遲動畫**: 重新分配 Services 區塊的網格版面為非對稱的 `12:7:5` 佈局。新增 `.animate-stagger` 特效，實施基於純 CSS 動畫延遲的 staggered 載入流動，令網頁載入體驗極其優雅。
  - **時間常數 $\tau$ 實體光暈**: 在 Hero 區塊右側，設計了一個由純 CSS 驅動的動態 `@keyframes tau-pulse` 擴展環光暈，並在後台疊加了高斯模糊處理的 GitHub 連接 chip 與 search 膠囊等真實產品 UI 證據，建立起清晰的前景-遠景對比，大幅加強科技視覺張力。


