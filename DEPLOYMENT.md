# 部署 taux.io

這份文件是部署這個網站的唯一依據。README.md 講開發，NOTES.md 記錄為什麼做了某些決定，**部署照這份做**。

網站是靜態的。執行期沒有伺服器、沒有資料庫、沒有環境變數、沒有機密。建置產生一個目錄，主機供應那個目錄。

---

## 1. 現況：這不是全新上線，是一次切換

`taux.io` 現在有流量，而且**線上版本是壞的**。切換之前先知道自己在取代什麼。

用 2026-07-27 量到的：

```
GET  https://taux.io/           200   內容是改名前的「拓思科技有限公司」
HEAD https://taux.io/           404
GET  https://taux.io/geo-guide  200
HEAD https://taux.io/geo-guide  404
server: cloudflare
```

三件事：

- **真實頁面對 HEAD 回 404。** 用 HEAD 的連結檢查器、uptime 監控與部分爬蟲會判定首頁不存在。本機用 wrangler 供應 `dist/` 時 HEAD 回 200，所以新部署會修掉它。契約測試現在對每條路由斷言 HEAD 的狀態碼，這類分歧不會再靜靜存在。
- **內容停在公司改名之前。** 線上首頁仍寫「拓思科技有限公司」，正確的是「拓思科技股份有限公司」。
- **已經在 Cloudflare 後面。** 所以這次不是把 DNS 從別的地方搬過來，是換掉 Cloudflare 後面供應內容的東西。

`taux.io` 過去是一台跑 Go 容器、由 nginx-proxy 反向代理、acme-companion 發 SSL 的主機。那套已經從 repo 移除（`main.go`、`Dockerfile`、`docker-compose*.yml`、`deploy.prod.sh` 都刪了），但**如果那台機器還在跑，切換完要記得收掉**——留著一台沒人部署、沒人更新、卻還能回應的來源，是下一次「線上跟 repo 不一樣」的來源。

---

## 2. 建置

```bash
npm ci
npm run build:css && npm run build:site
```

輸出在 `dist/`。

### 前置需求：Rust

**建置需要 Rust toolchain。這是這次改版新增的條件，Cloudflare Pages 的預設映像沒有 `cargo`。**

版本不要自己選，repo 裡釘好了：`rust-toolchain.toml`（channel 1.90）與 `.nvmrc`（Node 22）。rustup 會自己讀前者，`actions/setup-node` 與 `nvm` 會讀後者。

在沒有 cargo 的映像上，**這一整段就是可以貼進 Cloudflare Pages 建置指令欄的內容**：

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --no-modify-path && . "$HOME/.cargo/env" && npm ci && npm run build:css && npm run build:site
```

`rustup` 安裝完會讀 `rust-toolchain.toml`，所以不需要在指令裡指定版本。

### 設定摘要

| 項目 | 值 |
|---|---|
| Repository | `github.com/taux-io/official-website` |
| 分支 | `main` |
| 建置指令 | 見上（含 rustup 安裝那一整行） |
| 輸出目錄 | `dist` |
| 環境變數 | 無 |
| Node | 22（`.nvmrc`） |
| Rust | 1.90（`rust-toolchain.toml`） |

---

## 3. 主機必須做對的四件事

這四件都出過錯，而且四件都不會在 HTML 裡顯示出來。

**`_headers` 必須被套用。** 安全標頭與 CSP 全部在這個檔案裡，隨 `dist/` 一起部署。它們曾經在一個從未進入運行拓撲的 `nginx.conf` 裡，被 README 宣稱了好幾個月而一次都沒送出過。所以驗證的方式是**看回應帶回來的值**，不是確認檔案存在。

**`_headers` 的規則必須互不重疊。** Cloudflare 會**合併**所有符合的規則，不是最具體的勝出。`/static/*` 與 `/static/fonts/*` 同時命中，字體會拿到 `max-age=3600, max-age=31536000`，瀏覽器取第一個——為了效能自架的字體實際只快取一小時。這已經發生過一次，現在的規則是互斥的，改它的時候要維持這件事。

**未匹配路徑必須回 404 狀態，不是 200。** `404.html` 在 `site.toml` 裡宣告為 `[[document]]`，主機用它回應任何未匹配路徑。靜態主機最常見的錯誤是用 200 送出 404 頁面，Google 判定為 soft 404，可能連帶降權周邊路徑。

**檔案是扁平的 `.html`，不要開啟任何「目錄索引」或「加上尾斜線」的行為。** `geo-guide.html` 在 `/geo-guide` 直接供應。若主機把它當成目錄，`/geo-guide` 會 308 到 `/geo-guide/`——每一條已索引的 URL 多一跳，而 canonical 指向主機不直接服務的形式。

---

## 4. 上線後驗證

**部署完一定要跑這一段。** 上面四件事沒有一件會在瀏覽器裡看起來不對。

```bash
npm ci
BASE_URL=https://taux.io npm run contract
```

契約測試對每一條路由斷言：GET 狀態碼、**HEAD 狀態碼**、`lang`、canonical、分享圖、結構化資料、每一個被引用的資產（含 manifest 裡的圖示與 CSS 裡的字體）、CSP 是否實際送出且內容相符、快取分層、以及頁面有沒有拋 JS 錯誤。14 條路由、155 個斷言。

它需要 Playwright 的瀏覽器：

```bash
npx playwright install chromium
```

對比稽核可以一起跑：

```bash
BASE_URL=https://taux.io npm run contrast
```

不想裝瀏覽器的話，最低限度用 curl 確認上面第 3 節的四件事：

```bash
curl -sI https://taux.io/            | grep -i 'content-security-policy\|^HTTP'
curl -sI https://taux.io/static/fonts/D-DIN.woff2 | grep -i 'cache-control'   # 只能有一個 max-age
curl -s -o /dev/null -w '%{http_code}\n' https://taux.io/no-such-page          # 必須是 404
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' https://taux.io/geo-guide  # 必須是 200，無轉址
curl -sI -o /dev/null -w '%{http_code}\n' https://taux.io/                     # 必須是 200，不是 404
```

---

## 5. 回滾

建置產物是純靜態檔案，沒有資料遷移、沒有狀態。回滾就是重新部署上一個 commit。

Cloudflare Pages 保留每次部署，可以直接在儀表板上把舊的部署設回 production。

如果是內容問題而不是部署問題，正常流程是修 → 合併到 `main` → 重新部署；`main` 上每個 commit 都經過 CI 的 `build` 與 `audit` 兩個 job。

---

## 6. 部署方需要知道、但不在這份文件裡的事

- **CI 已經驗過的東西不需要在部署時重驗**：每個進 `main` 的 commit 都跑過對比稽核（1475 個文字元素、0 個低於 WCAG AA）與契約測試。上線後驗證要驗的是**主機的行為**，不是內容。
- **建置不讀 git。** 頁面日期宣告在 `site.toml`，所以淺層 clone 不影響任何輸出。先前的版本會讓每次部署把全站每一頁的修改日期蓋成部署當天——包括改個 README 錯字觸發的那次。
- **沒有機密、沒有環境變數。** 若部署設定裡出現任何一個，那是誤加的。
