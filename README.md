# TauX 拓思科技股份有限公司 - 官方網站

![TauX Logo](static/taux-logo-light.png)

**Code the Future - 用科技創造未來**

TauX 拓思科技股份有限公司專注於 AI Smart Work 與 GEO (Generative Engine Optimization)，運用 AI 技術為企業打造全方位數位轉型解決方案。

## 🚀 關於我們

我們是高雄在地的專業團隊，致力於為台灣企業提供最優質的數位化服務。結合軟體開發專業與創意行銷策略，為您的品牌創造數位時代的競爭優勢。

### 🎯 核心服務

- **💻 軟體平台開發** - 企業級 Web 應用、APP、SaaS 平台開發
- **🎬 短影片製作與策略** - TikTok、Instagram Reels、YouTube Shorts 內容製作
- **📈 數位行銷整合** - 社群媒體經營、SEO、廣告投放策略
- **🤖 AI 智能解決方案** - 智能客服、數據分析、自動化工具
- **⚙️ 系統整合與自動化** - CRM/ERP 系統串接、工作流程優化

## 🛠️ 技術規格

本站是**靜態網站**：建置時把模板算完，執行期沒有任何伺服器。

會走到這裡，是因為先前的 Go 伺服器對每個請求做的唯一變化只有頁尾的年份——同一條路由連續兩次請求回傳的位元組完全相同。既然如此就沒有東西需要在執行期算，只有檔案需要算一次交給 CDN，而那才是真正改善台灣以外讀者與爬蟲 TTFB 的做法。

- **Generator**: Rust，用 minijinja 把 `templates/*.html` 算成 `dist/` 底下的靜態檔
- **Frontend**: 靜態 HTML + TailwindCSS 3.4
- **Infrastructure**: Cloudflare Pages；標頭與快取宣告在 `_headers`
- **Design**: 單色深色系統 (spacex.com 語彙) — 黑底、自架 D-DIN、方角、髮絲線、零彩色。Token 定義於 `src/input.css` 的 `:root`
- **Security**: CSP 與安全標頭定義在 `_headers`，隨靜態檔一起部署

### 頁面宣告於 `site.toml`

所有頁面只在 `site.toml` 宣告一次。Rust generator、Node 工具鏈都讀同一張表，沒有任何一邊去解析另一邊的原始碼。新增一個 `[[page]]` 就同時帶動：算出 HTML、寫進 `sitemap.xml`、產生 OG 分享卡、納入對比稽核與路由契約測試。

## 📁 專案結構

```
taux-dev/
├── site.toml                   # 頁面宣告 (路由、title、description、canonical、日期)
├── generator/                  # Rust 靜態網站產生器
├── _headers                    # Cloudflare Pages 標頭與快取規則 (含 CSP)
├── templates/                  # Jinja 模板
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
├── static/                     # 靜態資源
│   ├── css/                    # 編譯後的 CSS
│   ├── js/                     # 前端 JavaScript
│   └── img/                    # 圖片資源
├── src/                        # 前端原始碼 (CSS input)
├── tailwind.config.js          # Tailwind 設定
├── scripts/visual/             # 對比稽核、路由契約測試、截圖、像素比對
├── scripts/assets/             # 圖示、結構化資料 logo、OG 分享卡生成
└── dist/                       # 建置產物 (不進版控)
```

## 🤖 AI 協作體系

`.agents/` 不在版本控制內。它描述的是「怎麼在這個專案上工作」而不是「這個專案是什麼」，而它的基礎設施那一半仍在描述已經刪除的 Docker 與 nginx 部署——一份被 check in 的文件如果過時，讀它的人沒有理由懷疑它。

專案本身的長期記憶與技術決策紀錄在 **[NOTES.md](NOTES.md)**。

## 🔒 安全機制

### 標頭 (`_headers`)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(), microphone=(), camera=()`

### Content-Security-Policy (`_headers`)
- `script-src 'self' https://cdn.jsdelivr.net` — **無 `unsafe-inline`**
- `style-src` 需要 `unsafe-inline`（16 個 style 屬性 + 2 個行內區塊）
- `font-src 'self'` — 字體已自架
- `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`

> 此 policy 曾經只存在於 `nginx.conf`，而該檔案不在實際運行的拓撲中，等於從未生效——整整一年沒有人發現，因為缺少 CSP 的頁面看起來和有 CSP 的頁面一模一樣。現在它在 `_headers`，而路由契約測試會對每一條路由斷言標頭確實存在且內容相符。

### 為什麼一定要用 wrangler 在本機驗

一般的靜態檔案伺服器不讀 `_headers`。用它預覽，一條永遠匹配不到的規則看起來會完全正常——上面那個一年沒生效的 CSP 就是這樣活下來的。`npx wrangler pages dev dist` 會套用真正的規則，稽核才有意義。

## 🚀 快速開始

1. **安裝依賴**
   ```bash
   npm install        # Tailwind 與工具鏈
   # Rust toolchain：https://rustup.rs
   ```

2. **建置**
   ```bash
   npm run build:css   # src/input.css -> static/css/styles.min.css
   npm run build:site  # templates/ + site.toml -> dist/
   ```

3. **預覽 (務必用 wrangler，它才會套用 `_headers`)**
   ```bash
   npx wrangler pages dev dist --port 8099
   open http://127.0.0.1:8099
   ```

4. **改 CSS 時開監聽**
   ```bash
   npm run watch:css
   ```

### 檢查

```bash
npm run check:css      # styles.min.css 與 input.css 是否同步
npm run check:classes  # 模板裡有沒有 Tailwind 產不出 CSS 的 class
npm run check:llms     # llms.txt 有沒有漏掉已發布的頁面
npm run check:dates    # 每頁都有可用的日期，且沒有未來或早於發布的修改日
npm run check:jsonld   # 結構化資料有效，且沒有重複鍵
npm run dates          # 宣告的日期 vs git 認為的（僅報告，不會寫入）
npm run contrast       # WCAG 對比稽核 (需 wrangler 在 8099)
npm run contract       # 路由契約：狀態碼、canonical、標頭、結構化資料、JS 錯誤
cargo test --manifest-path generator/Cargo.toml   # generator 的輸出路徑、slug、註解剝除
```

`check:classes` 是這個專案最高頻的風險。Tailwind 遇到解析不出來的 class 什麼都不產，所以 markup 看起來是刻意的、建置也成功，只有效果消失——改版時一次找出 55 個這種 class，其中包括讓 prompting 指南整條時間軸的圓點隱形的那些。

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
**Developers**: 建置、檢查與新增頁面的流程見上方各節；技術決策紀錄見 `NOTES.md`。

### 新增頁面
1. 在 `templates/` 目錄下創建新的 HTML 檔案 (參考 `templates/index.html`)
2. 在 `site.toml` 新增一個 `[[page]]` 區塊
3. 更新 `header.html` (PC & Mobile) 與 `footer.html` 導航連結

`sitemap.xml` 不用改——它是從 `site.toml` 產生的，所以頁面不可能漏掉，`lastmod` 也不可能和頁面自己的結構化資料打架。這兩件事在手寫 sitemap 的時代都發生過。

### 日期

`dateModified` 取自最後一次改動該模板的 commit。頁面自己手寫日期時每一個都是錯的：六篇文章全部寫著四月，內容卻是當天重寫的，其中四篇還和 sitemap 對同一個 URL 的 `lastmod` 互相矛盾。

若某次 commit 動了模板但沒有改變頁面說的內容（改 class 名、修錯字），在 `site.toml` 寫一行 `date_modified` 覆寫——修改日期跟著裝飾性改動跳動，是內容撐不起來的新鮮度宣稱。

`date_published` 維持手寫，放在 `site.toml`：那是事實，不是推導值。

## 🚀 部署說明

建置產物是 `dist/`，一個純靜態目錄，交給 Cloudflare Pages。

```bash
npm run build:css && npm run build:site
```

- **建置指令**：`npm run build:css && npm run build:site`
- **輸出目錄**：`dist`
- **標頭與快取**：`_headers`，隨檔案一起部署

### 檔案為什麼是扁平的 `.html`

`geo-guide.html` 而不是 `geo-guide/index.html`。後者在 `/geo-guide/` 被供應，而 `/geo-guide` 會拿到一個 308 轉址——每一條已經被索引的 URL 都多一跳，canonical 指向的位置主機還不直接供應。扁平檔案在 `/geo-guide` 直接命中，沒有轉址。

### 錯誤頁

只有 404。500 沒有應用程式可以失敗，502／503 沒有來源伺服器可以失效——三者在靜態託管下都沒有任何機制會供應，已移除。

## 📞 聯絡資訊

- **公司名稱**: TauX 拓思科技股份有限公司
- **網站**: https://taux.io
- **電子郵件**: hello@taux.io
- **電話**: 07-6211033
- **地址**: 高雄市岡山區文賢路 57 號 2 樓

## 📝 授權條款

© 2026 TauX 拓思科技股份有限公司. 保留所有權利.

---

**Code the Future - 用科技創造未來** 🚀