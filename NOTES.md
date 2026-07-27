# TauX 專案筆記

這份文件描述**現況**，不是歷史。歷史在 `git log` 裡。

先前的版本同時保留了三代設計系統的描述，讀者無從判斷哪一段還有效——實際上沒有一段有效。若要記錄變更，請修改下面的段落，不要在後面追加新章節。

---

## 專案概覽

TauX（拓思科技）專注於 GEO（生成式引擎優化）、AI Agent 開發、軟體平台建置與企業 AI 內訓。

## 架構

- **產生器**：Rust（minijinja），build 時輸出靜態 HTML
- **前端**：`templates/*.html` + TailwindCSS 3.4，無前端框架
- **工具鏈**：Node 負責 CSS 建置、資產生成與全部驗證（Tailwind 與 Playwright 沒有堪用的 Rust 替代品，所以這個 repo 是雙語言的）
- **基礎設施**：Cloudflare Pages，無執行期伺服器

---

## 設計系統

單色深色，取自 spacex.com 的語彙：黑底、D-DIN、方角、髮絲線、**完全不使用彩色**。

### Token

色彩與圓角定義在 `src/input.css` 的 `:root`，`tailwind.config.js` 只暴露語意名稱（`bg-surface`、`text-ink-body`、`border-line`）。**模板裡不應出現任何 hex 值。**

改主題只需要動這七個變數：

| 變數 | 值 | 用途 |
|---|---|---|
| `--surface-deep` | `#000000` | 全幅 hero 區塊 |
| `--surface` | `#0a0a0b` | 頁面基底 |
| `--surface-raised` | `#0f0f11` | 需要層次的面板 |
| `--text-primary` | `#ffffff` | 標題、強調 |
| `--text-body` | `#c8c8cc` | 內文 |
| `--text-muted` | `#8a8a91` | 標籤、註解 |
| `--line` / `--line-strong` | 白色 8% / 20% | 分隔線 / 按鈕框 |

色彩以空格分隔的 channel 形式儲存（`--surface-rgb: 10 10 11`），Tailwind 的透明度修飾字才能運作（`bg-surface/50`）；每個色彩另有純色別名供手寫 CSS 使用。

### 幾個不明顯的決定

以下每一項都是有人「順手改一下」時最容易破壞的：

- **中文走系統字體，不是刻意省事。** D-DIN 只涵蓋拉丁字元，`unicode-range` 明確限定範圍，所以中文永遠不會等待字體下載，直接由蘋方／微軟正黑渲染。繁體中文網頁字體即使切片也有數百 KB，且 swap 時會整頁重排——長文頁的搜尋表現正是它們存在的理由，不值得拿去換字體一致性。**Windows 的中文會比 Mac 差一階，這是已知且接受的代價。**
- **內文色不是純白。** `#c8c8cc` 而非 `#ffffff`。純白配純黑會產生光暈溢散，中文筆劃密集時特別明顯。
- **卡片是髮絲框，不是填色。** 無底色、無陰影、無圓角、無 hover 位移。
- **圓角一律為 0，但 `rounded-full` 保留。** 正圓（儀表、軌道）屬於這套語彙，圓角矩形不屬於。
- **大寫與寬字距只用在拉丁元素。** 中文沒有大寫，寬字距套在中文上只會難讀。設計的識別度由導航列、eyebrow 標籤、章節編號承擔。
- **不使用捲動揭示動畫。** 曾經有過，用 JS 設 `opacity-0` 再由 IntersectionObserver 解除——快速捲動會超過觀察器，元素永久隱形（首頁曾有 19 個），而且讓內文的可見性取決於 JS 執行成功。視差效果只寫 `transform`，絕不碰 `opacity`。

### τ 曲線

`static/js/tau-curve.js` 畫的是二階欠阻尼系統的階躍響應——τ 是時間常數，這條曲線就是它的定義圖。首頁描繪一次後緩慢呼吸；長文頁是靜態細帶。

描繪階段用 rAF，收斂後的呼吸改用計時器（30fps）。**不要把呼吸改回 rAF**：那會讓主執行緒以螢幕更新率被喚醒卻什麼都不畫。離開視窗或分頁隱藏時完全停止。

---

## 建置與檢查

```bash
npm run build:site     # cargo build + 產生 dist/
npm run serve          # wrangler pages dev dist（套用 _headers）
npm run compare        # 與 Go 版輸出逐位元比對（見 scripts/migration/README.md）
npm run build:css      # src/input.css -> static/css/styles.min.css
npm run watch:css
npm run check:css      # 已提交的 CSS 是否與目前的模板一致
npm run build:assets   # 圖示 + 結構化資料 logo + OG 分享卡
npm run contrast       # WCAG 稽核（CI 閘門）
npm run contract       # 路由對外宣告的契約（CI 閘門）
npm run check:classes  # 找出不產生任何 CSS 的類別（CI 閘門）
npm run screenshot <label>   # 截圖到 .visual/<label>/
npm run diff <a> <b>         # 像素比對
```

`.github/workflows/checks.yml` 在 PR 與推送 main 時跑 `cargo fmt` / `cargo clippy` / `build:site` / `check:css` / `check:classes` / `contrast` / `contract`。後兩者跑在 wrangler 供應的 `dist/` 上，因為只有 wrangler 會套用 `_headers`——用一般靜態伺服器驗，一條永遠匹配不到的標頭規則看起來完全正常。

三道閘門的門檻都設在「乾淨」而非「不要更糟」，趁現在乾淨時設，才不需要維護一份豁免清單：

- **contrast** —— 0 隱形元素、0 不符 WCAG AA
- **contract** —— 每條路由的狀態碼、`lang`、canonical、分享圖、結構化資料、**所有引用資產（含 manifest 裡的圖示與 CSS 裡的字體）**、CSP 違規、JS 錯誤
- **check:classes** —— 沒有任何類別產生不出 CSS

截圖與像素比對刻意不設為閘門：跨機器的字體渲染差異會產生假警報，它們是給人看的工具。

### `styles.min.css` 是進版控的建置產物

Tailwind 掃描模板產生它，所以**改完模板沒重建就會靜默失效**——曾經發生過，`.md:h-20` 沒進去，七個頁面的曲線細帶少了 16px 而毫無跡象。`npm run check:css` 就是為此存在。

### `?v=` 版號是手動的

`header.html` 和 `footer.html` 引用 CSS/JS 時帶著 `?v=N`。**改了那些檔案就要遞增它，沒有任何東西會提醒你。** 也因為如此，CSS/JS 的 `Cache-Control` 只給一小時而非 immutable——押注在人的記性上，代價是使用者永久卡在舊版且無法復原。

---

## 部署

**靜態網站，由 Cloudflare Pages 從邊緣節點供應。** 沒有執行期伺服器。

```bash
npm run build:site   # cargo build + 產生 dist/
npm run serve        # wrangler pages dev dist（本機，會套用 _headers）
```

`dist/` 由 `generator/`（Rust + minijinja）從 `templates/` 與 `site.toml` 產生。推送到 main 觸發 Cloudflare 建置。

### 幾個必須知道的細節

- **輸出是扁平的 `.html`，不是目錄。** `geo-guide.html` 在 `/geo-guide` 直接供應；若寫成 `geo-guide/index.html`，主機會把 `/geo-guide` **308 重導**到 `/geo-guide/`——每條已索引的 URL 多一跳，而 canonical 指向主機不直接服務的形式。
- **`_headers` 的規則必須互不重疊。** Cloudflare **合併**所有符合的規則，不是最具體的勝出。`/static/*` 與 `/static/fonts/*` 同時命中會產生 `max-age=3600, max-age=31536000` —— 瀏覽器取第一個，字體實際只快取一小時。這已經發生過一次。
- **`404.html` 不是路由。** 它在 `site.toml` 裡宣告為 `[[document]]`，主機用它回應任何未匹配路徑並附上 404 狀態。**靜態主機最常見的錯誤是用 200 送出 404 頁面**，Google 視為 soft 404 並可能連帶降權周邊路徑。契約測試會斷言這一點。
- **靜態站沒有 500。** 沒有應用程式可以失敗，該頁已移除。
- **502/503 由 nginx-proxy 從自己的 volume 供應**，不在 `dist/` 裡。它們的行內 `<script>` 必須保持行內——後端已死時 `/static` 拿不到。

### 標頭

安全標頭與 CSP 在 `_headers`，進版控、可 review、**且由契約測試斷言實際送出的值**。

它們先前在 Go middleware，更早在一個從未生效的 `nginx.conf` 裡——那個檔案不在運行中的拓撲裡，policy 被 README 宣稱了數個月卻從未送出任何一次。所以測試斷言的是**回應帶回來的值**，不是「設定檔存在」。

### 本機測試必須用 `wrangler pages dev`

普通靜態伺服器不套用 `_headers`。用它跑測試，標頭斷言會對著沒人送出的標頭通過——正是上面那個失敗模式的重演。

---

## 資產

`npm run build:assets` 產生全部三類，改主題後重跑一次就會同步：

- **圖示**：由 `static/brand/icon-master.png` 產生。母檔與輸出分離是必要的——腳本會覆寫 `android-chrome-512x512.png`，若從那裡讀來源，第二次執行會吃自己的輸出並產出白方塊。
- **結構化資料 logo**：`static/brand/logo-on-light.png`，由 `taux-logo-light.png` 裁切而來。**命名描述使用情境而非顏色**：原本的 `taux-logo-dark.png`（給深色底用的白色標記）曾被誤當成「深色的 logo」放進 JSON-LD，於是 Google 收到一張白底白字。
- **OG 分享卡**：每條路由一張，標題取自 `site.toml`，檔名由 canonical URL 推導——與 generator 算 `og_image` 用同一條規則，兩邊不可能分歧。

---

## 已知待辦

- `templates/building.html` 同時作為 Blog、Careers、API 三個連結的目的地
- `?v=` 版號手動遞增（見上）
- Windows 中文渲染品質低於 macOS（見上）
