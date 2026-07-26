# TauX 專案筆記

這份文件描述**現況**，不是歷史。歷史在 `git log` 裡。

先前的版本同時保留了三代設計系統的描述，讀者無從判斷哪一段還有效——實際上沒有一段有效。若要記錄變更，請修改下面的段落，不要在後面追加新章節。

---

## 專案概覽

TauX（拓思科技）專注於 GEO（生成式引擎優化）、AI Agent 開發、軟體平台建置與企業 AI 內訓。

## 架構

- **後端**：Go 1.24+ / Gin，伺服器端渲染
- **前端**：`templates/*.html` + TailwindCSS 3.4，無前端框架
- **基礎設施**：Docker（distroless/nonroot）+ nginx-proxy + acme-companion 自動 SSL

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
npm run build:css      # src/input.css -> static/css/styles.min.css
npm run watch:css
npm run check:css      # 已提交的 CSS 是否與目前的模板一致
npm run build:assets   # 圖示 + 結構化資料 logo + OG 分享卡
npm run contrast       # WCAG 稽核（CI 閘門）
npm run screenshot <label>   # 截圖到 .visual/<label>/
npm run diff <a> <b>         # 像素比對
go run main.go         # 預設 :8080，可用 PORT 覆寫
```

`.github/workflows/checks.yml` 在 PR 與推送 main 時跑 `go build` / `go vet` / `gofmt` / `check:css` / `contrast`。**對比稽核目前是 0 隱形、0 不符 AA，閘門就是「不准變成非零」**——趁乾淨時設門檻，才不需要維護一份豁免清單。截圖與像素比對刻意不設為閘門：跨機器的字體渲染差異會產生假警報，它們是給人看的工具。

### `styles.min.css` 是進版控的建置產物

Tailwind 掃描模板產生它，所以**改完模板沒重建就會靜默失效**——曾經發生過，`.md:h-20` 沒進去，七個頁面的曲線細帶少了 16px 而毫無跡象。`npm run check:css` 就是為此存在。

### `?v=` 版號是手動的

`header.html` 和 `footer.html` 引用 CSS/JS 時帶著 `?v=N`。**改了那些檔案就要遞增它，沒有任何東西會提醒你。** 也因為如此，CSS/JS 的 `Cache-Control` 只給一小時而非 immutable——押注在人的記性上，代價是使用者永久卡在舊版且無法復原。

---

## 部署

**`deploy.prod.sh` 是唯一有效的部署路徑。** 它在正式機上 `git pull`、`docker build`、然後直接 `docker run` 把 Go 容器掛上 `VIRTUAL_HOST=taux.io` 接到 `taux_frontend` 網路，由 nginx-proxy 反向代理。

- `docker-compose.prod.yml` 與 `nginx.conf` **已於清理時刪除**。前者的 `nginx` 服務既無 `image` 也無 `build`，`docker compose config` 直接判定無效，不可能啟動過；後者從未在這個拓撲中生效。若你的部署確實依賴它們，`git log` 裡有。
- **安全標頭與 CSP 現在都在 `main.go` 的 middleware**，隨應用程式走。先前 CSP 只寫在 `nginx.conf` 裡，等於從未生效。
- **502/503 錯誤頁由 nginx-proxy 從它自己的 `html` volume 供應**（`/usr/share/nginx/html/`），`git pull` 碰不到。倉庫裡的 `static/502.html`、`static/503.html` 是原始版本，要客製得由部署方複製進 volume。它們的行內 `<script>` 必須保持行內——後端已死時 `/static` 拿不到。

### SSL

`nginxproxy/acme-companion` 自動處理，不需要手動 certbot。確認容器的 `VIRTUAL_HOST` 與 `LETSENCRYPT_HOST` 正確即可。

---

## 資產

`npm run build:assets` 產生全部三類，改主題後重跑一次就會同步：

- **圖示**：由 `static/brand/icon-master.png` 產生。母檔與輸出分離是必要的——腳本會覆寫 `android-chrome-512x512.png`，若從那裡讀來源，第二次執行會吃自己的輸出並產出白方塊。
- **結構化資料 logo**：`static/brand/logo-on-light.png`，由 `taux-logo-light.png` 裁切而來。**命名描述使用情境而非顏色**：原本的 `taux-logo-dark.png`（給深色底用的白色標記）曾被誤當成「深色的 logo」放進 JSON-LD，於是 Google 收到一張白底白字。
- **OG 分享卡**：15 張，標題取自 `main.go`，檔名由 canonical URL 推導——與 `ogImage` template helper 用同一條規則，兩邊不可能分歧。

---

## 已知待辦

- `templates/building.html` 同時作為 Blog、Careers、API 三個連結的目的地
- `?v=` 版號手動遞增（見上）
- Windows 中文渲染品質低於 macOS（見上）
