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
- **基礎設施**：Cloudflare Workers 靜態資產，無執行期伺服器

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
npm run serve          # wrangler dev（套用 _headers）
npm run build:css      # src/input.css -> static/css/styles.min.css
npm run watch:css
npm run check:css      # 已提交的 CSS 是否與目前的模板一致
npm run build:assets   # 圖示 + 結構化資料 logo + OG 分享卡
npm run contrast       # WCAG 稽核（CI 閘門）
npm run contract       # 路由對外宣告的契約（CI 閘門）
npm run check:classes  # 找出不產生任何 CSS 的類別（CI 閘門）
npm run check:llms     # llms.txt 有沒有漏掉已發布的頁面（CI 閘門）
npm run check:dates    # 日期已宣告且自洽（CI 閘門）
npm run check:jsonld   # 結構化資料有效且無重複鍵（CI 閘門）
npm run dates          # 宣告的日期 vs git 認為的（僅報告）
npm run screenshot <label>   # 截圖到 .visual/<label>/
npm run diff <a> <b>         # 像素比對
```

`.github/workflows/checks.yml` 在 PR 與推送 main 時跑 `cargo fmt` / `cargo clippy` / `build:site` / `check:css` / `check:classes` / `contrast` / `contract`。後兩者跑在 wrangler 供應的 `dist/` 上，因為只有 wrangler 會套用 `_headers`——用一般靜態伺服器驗，一條永遠匹配不到的標頭規則看起來完全正常。

六道閘門的門檻都設在「乾淨」而非「不要更糟」，趁現在乾淨時設，才不需要維護一份豁免清單：

- **contrast** —— 0 隱形元素、0 不符 WCAG AA
- **contract** —— 每條路由的狀態碼、`lang`、canonical、分享圖、結構化資料、**所有引用資產（含 manifest 裡的圖示與 CSS 裡的字體）**、CSP 違規、JS 錯誤
- **check:classes** —— 沒有任何類別產生不出 CSS
- **check:llms** —— 每一個已發布的頁面都在 llms.txt 裡
- **check:dates** —— 每頁都宣告日期，沒有未來日期，發布日不晚於修改日
- **check:jsonld** —— 結構化資料有效，且沒有重複鍵（`JSON.parse` 看不到重複鍵，它會靜靜取最後一個）

截圖與像素比對刻意不設為閘門：跨機器的字體渲染差異會產生假警報，它們是給人看的工具。

### `styles.min.css` 是進版控的建置產物

Tailwind 掃描模板產生它，所以**改完模板沒重建就會靜默失效**——曾經發生過，`.md:h-20` 沒進去，七個頁面的曲線細帶少了 16px 而毫無跡象。`npm run check:css` 就是為此存在。

### `?v=` 版號是手動的

`header.html` 和 `footer.html` 引用 CSS/JS 時帶著 `?v=N`。**改了那些檔案就要遞增它，沒有任何東西會提醒你。** 也因為如此，CSS/JS 的 `Cache-Control` 只給一小時而非 immutable——押注在人的記性上，代價是使用者永久卡在舊版且無法復原。

---

## 部署

**靜態網站，由 Cloudflare Workers 以靜態資產（static assets）從邊緣節點供應。** 沒有執行期伺服器，`wrangler.jsonc` 裡也沒有 `main`——沒有任何程式碼會執行。

```bash
npm run build:site   # cargo build + 產生 dist/
npm run serve        # wrangler dev（本機，會套用 _headers）
```

`dist/` 由 `generator/`（Rust + minijinja）從 `templates/` 與 `site.toml` 產生。

**部署步驟在 [DEPLOYMENT.md](DEPLOYMENT.md)，不在這裡。** 這一節記錄的是為什麼，不是怎麼做。

### 為什麼是 Workers 而不是 Pages

先前的計畫是 Cloudflare Pages，而且 repo 一度整個是那個形狀（`wrangler pages dev`、Pages 的建置設定表）。**那一步從來沒有真的走完**——`taux.io` 直到切換前都還是那台 Go 主機在服務，Pages 專案根本不存在。所以這不是「從 Pages 遷移」，是在還沒落地前換掉目標。

換掉的理由是 `versions upload`：它會發佈一個版本並給出 preview URL，**但不導任何流量過去**。Pages 沒有這個形狀的東西。這讓「上線」可以跟「建置」分開成兩個決定，而不是推送即上線。

`_headers` 在兩者的行為一致，包括**合併**而非最具體者勝出——所以下面那條互不重疊的紀律原封不動繼續有效。

### 建置為什麼從 GitHub Actions 搬回 Cloudflare

2026-07-29 的第一版把建置與部署都放在 GitHub Actions，理由寫得很硬：Cloudflare 的建置映像沒有 `cargo`，所以走它的整合就得在指令欄塞一串 rustup 安裝；而且 CI 驗過的產物跟上線的產物不是同一份。

**兩個理由到今天都還成立，是取捨的權重改了。** 決定是把部署收斂到單一供應商，接受那兩個代價，換掉「維護一組 API token、一個 deploy job、以及兩個系統之間的接縫」。

代價要說清楚，因為它們不會自己浮現：

- **自動的上線關卡沒有了。** 先前 CI 的流程是 `upload → 拿 preview URL → 跑 156 條契約測試 → 通過才推`。Workers Builds 的建置流程裡跑不了 Playwright、也拿不到 preview URL 去測，更沒有「檢查失敗就不推」的機制。現在擋在訪客前面的是人：版本上傳後不會自動上線，推廣是手動的一步。
- **上線的產物沒有被驗過。** CI 仍然建置並跑完整檢查，但那份產物不會被部署；上線的是 Cloudflare 自己 clone 後建的。同一個 commit、同一組釘死的 toolchain 版本，理論上相同——**但沒有任何東西在比對它們**。

保留 GitHub Actions 的 `build` 與 `audit` 是這個決定的另一半：PR 階段的六道閘門一個都沒少，少掉的只有 `deploy` job。

### 為什麼 HSTS 不在 `_headers` 裡

`Strict-Transport-Security` 設在 Cloudflare zone（SSL/TLS → Edge Certificates），不在 `_headers`。這是刻意的取捨，也**違反**本文件其他地方的偏好（政策要在 repo 裡），所以記在這裡：zone 設定涵蓋整個網域而不只這個 Worker 供應的路徑。

代價是真的：它重蹈了「設定活在後台、無法在 review 裡看到」這個這個專案被咬過的模式。緩解方式是契約測試**照樣對回應斷言它**——但只有在 `BASE_URL` 指向 `https://taux.io` 時才做得到，因為 zone 設定不會套到 preview URL。所以這一項不在上線關卡裡，只能在切換後驗。契約測試會在沒做這些斷言的每一次執行印出 `NOT ASSERTED`，避免「0 failing」被讀成「全部都檢查過了」。

www → apex 的 301 同理，設在 zone 的 Redirect Rule。**不是**寫在 `_redirects` 裡——Cloudflare 的 `_redirects` 來源端只接受路徑，明文不支援域名層級轉址。

### 切換那天壞掉的三件事

三件都是「看起來成立、實際不成立」，而且三件的第一版檢查都放行了它們。記在這裡是因為每一件的**檢查方式**才是教訓，不是那個設定本身。

**`${{ runner.temp }}` 不能寫在 job 層的 `env`。** `runner` context 只存在於 step。放在 job 層不是某個 step 失敗——GitHub 在建立任何 job **之前**就拒收整份 workflow，於是 run 在 0 秒內失敗、沒有 log、`gh pr checks` 回報「沒有任何 check」。那個空白很容易被讀成「CI 還沒開始跑」。

放行它的檢查是一段 regex，掃檔案找 job 名稱——它把 `on:` 底下的 `pull_request` 和 `push` 也報成了 job。那個明顯錯誤的輸出當下沒有被追究。**YAML 要用解析器驗，不是用 regex 掃**；現在的做法是真的 parse 出 `jobs` 的 key，並掃描每個 job 層 `env` 有沒有用到 step-only 的 context。

**Workers Builds 的失敗不是缺 `cargo`。** 當時的假設是「Cloudflare 的建置映像沒有 Rust」，因為那正是離開 Pages 的理由，聽起來完全合理。實際 log 顯示它根本沒設建置指令：`npm ci` 之後直接跑 `wrangler versions upload`，所以 `dist/` 從未被產生，連需要 `cargo` 的那一步都沒走到。

教訓不是那個成因，是**一個符合既有敘事的假設最不容易被查證**。log 一直都拿得到，只是沒去讀。

**Redirect Rules 的 wildcard `*` 不匹配空字串。** `https://www.taux.io/*` 匹配 `/geo-guide`，但**不匹配裸的根路徑** `https://www.taux.io/`。所以第一版規則做出來的結果是：所有子路徑正確轉址，首頁靜靜地繼續回 200。

官方文件沒有寫 `*` 能不能匹配空字串，所以現在的規則改用 `http.host eq "www.taux.io"` 搭配 `concat("https://taux.io", http.request.uri.path)`——**匹配條件是 hostname 而不是 URL 形狀**，根路徑因此按定義包含在內，不依賴任何沒被文件化的行為。

契約測試同時斷言 `/` 和 `/geo-guide` 就是為了這個。只測其中一條，兩種常見的錯誤設定各有一種會全綠通過。

### 幾個必須知道的細節

- **輸出是扁平的 `.html`，不是目錄。** `geo-guide.html` 在 `/geo-guide` 直接供應；若寫成 `geo-guide/index.html`，主機會把 `/geo-guide` **308 重導**到 `/geo-guide/`——每條已索引的 URL 多一跳，而 canonical 指向主機不直接服務的形式。
- **`_headers` 的規則必須互不重疊。** Cloudflare **合併**所有符合的規則，不是最具體的勝出。`/static/*` 與 `/static/fonts/*` 同時命中會產生 `max-age=3600, max-age=31536000` —— 瀏覽器取第一個，字體實際只快取一小時。這已經發生過一次。
- **`404.html` 不是路由。** 它在 `site.toml` 裡宣告為 `[[document]]`，主機用它回應任何未匹配路徑並附上 404 狀態。**靜態主機最常見的錯誤是用 200 送出 404 頁面**，Google 視為 soft 404 並可能連帶降權周邊路徑。契約測試會斷言這一點。
- **靜態站沒有 500。** 沒有應用程式可以失敗，該頁已移除。
- **靜態站沒有 502／503。** 沒有會失效的來源伺服器，沒有機制會供應它們，該兩頁已移除。

### 標頭

安全標頭與 CSP 在 `_headers`，進版控、可 review、**且由契約測試斷言實際送出的值**。

它們先前在 Go middleware，更早在一個從未生效的 `nginx.conf` 裡——那個檔案不在運行中的拓撲裡，policy 被 README 宣稱了數個月卻從未送出任何一次。所以測試斷言的是**回應帶回來的值**，不是「設定檔存在」。

### 本機測試必須用 `wrangler dev`

普通靜態伺服器不套用 `_headers`。用它跑測試，標頭斷言會對著沒人送出的標頭通過——正是上面那個失敗模式的重演。

`wrangler dev` 讀 `wrangler.jsonc`，所以本機拿到的是跟邊緣同一份資產設定（含 `not_found_handling`）。實測過四條硬規則在本機與真實邊緣的行為一致，這是 PR 階段仍然只跑本機模擬器的依據。

---

## 從 Go 遷移到 Rust 的紀錄

比對工具已刪除。它需要一台跑著 Go 伺服器的機器來產生基準，而那個伺服器已經不存在，所以它不可能再跑一次；留著一個永遠報 14 個差異的指令，看起來像壞掉的檢查而不是完成的驗證。留下的是知識。

**主張**：產生的網站與 Go 伺服器供應的內容逐位元相同。14 頁全數相符。

這個主張比檢查表值錢：如果每個位元組都相符，就不可能有任何 canonical、結構化資料、標題、內部連結或 meta description 改變過——它們的聯集就是那個檔案。是二元的、完整的，不需要判斷哪些訊號重要。

**被正規化掉的三件事，各自的理由**：

| 規則 | 理由 |
|---|---|
| 版權年份 | Go 每個請求讀時鐘，generator 在建置時烘進去。同一個值，不同機制。 |
| 前後空白 | Go 的 `{{ define }}` 在 doctype 前留了一個空行。那個構造已經不存在，而 doctype 之前的空白不帶任何意義。 |
| 字元參照寫法 | Go 把跳脫的單引號寫成 `&#39;`，minijinja 寫成 `&#x27;`。同一個字元。 |

每一條都是真的回歸可以藏身的地方，所以清單保持很短，而且每一條都在上面寫明理由，而不是靜靜累積。

**這個比對看不到的東西**，而遷移出錯的兩次都在那裡：

- `/geo-guide` 回 **308** 而不是 200。寫成 `geo-guide/index.html` 的頁面在 `/geo-guide/` 供應，裸路徑會轉址——每一條已索引的 URL 都多一跳，canonical 還指向主機不直接供應的形式。
- 字體的 `Cache-Control` 回來是 `max-age=3600, max-age=31536000`。主機把每條匹配的規則合併而不是讓最 specific 的勝出，瀏覽器取第一個，於是為了效能自架的字體會被快取一小時。

兩個都是靠 wrangler 真的供應輸出、問它要標頭才抓到的。兩個在 HTML 裡都看不見。這就是為什麼路由契約測試跑在 `npm run serve` 上，而且對標頭值做正面斷言。

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
