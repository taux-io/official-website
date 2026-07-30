# 部署 taux.io

這份文件是部署這個網站的唯一依據。README.md 講開發，NOTES.md 記錄為什麼做了某些決定，**部署照這份做**。

網站是靜態的。執行期沒有伺服器、沒有資料庫、沒有執行期環境變數、沒有執行期機密。建置產生一個目錄，Cloudflare Workers 從邊緣供應那個目錄。`wrangler.jsonc` 裡沒有 `main`，所以沒有任何程式碼會執行。

**部署是全自動的。** 推送到 `main`，Cloudflare 會自己 clone、建置、上線。**沒有自動的上線關卡**——擋在 production 前面的是 PR 階段的 CI，理由與代價見第 4 節。

---

## 1. 現況：切換已於 2026-07-29 完成

`taux.io` 現在由 Worker `taux-io` 供應。切換那天量到的都記在這裡，因為沒有一項會在瀏覽器裡看起來不對。

切換前後對照，同一天量的：

| | 切換前（Go 主機） | 現在（Worker） |
|---|---|---|
| `HEAD /` | **404**（`GET /` 是 200） | **200** |
| `content-security-policy` | 無 | 送出，與 `_headers` 逐字相符 |
| `x-xss-protection` | `1; mode=block` | 消失（Go middleware 的產物） |
| 字體 `cache-control` | `max-age=14400` | `public, max-age=31536000, immutable` |
| 首頁公司名 | 拓思科技**有限公司** | 拓思科技**股份**有限公司 |
| `cf-cache-status` | `DYNAMIC`（代理到來源） | `HIT` |

`HEAD /` 回 404 而 `GET /` 回 200，是用 HEAD 的連結檢查器、uptime 監控與部分爬蟲會把首頁判定為不存在——瀏覽器永遠不會發 HEAD 來載入頁面，所以那個分歧在畫面上不可見，活了很久。契約測試現在對每條路由分別斷言 GET 與 HEAD。

切換當天的驗證跑了兩輪。第一輪 **134 條斷言、3 條失敗**，三條全是 zone 層設定尚未建立——HSTS 未開、www 回 200 而不是 301。兩者補上之後重跑：**14 條路由、134 條斷言、0 條失敗**。主機行為沒有任何一項出錯。

那三條失敗值得留下來，因為它們是**選擇把設定放在 zone 而不是 repo 的代價**具體長什麼樣：切換當下 HSTS 是真的消失了（Go 主機原本送 `max-age=31536000`），而那個倒退不會出現在任何一次 CI 的綠燈裡，只有對 production 跑才看得到。

### 怎麼判定 Workers Builds 有沒有在動

**看有沒有名為 `Workers Builds: taux-io` 的 check _run_，不是看有沒有 `cloudflare-workers-and-pages` 的 check _suite_。**

沒有連 Git 整合時，推送仍然會產生一個 `cloudflare-workers-and-pages` 的 check suite，狀態停在 `queued`、`latest_check_runs` 是 0。那是 Cloudflare 的 GitHub App 還安裝在 repo 上的殘影——**App 的安裝是 repo 層的，跟 Worker 的 Git 整合是兩回事**。它看起來像整合還在，其實沒有任何建置被建立。

```bash
gh api repos/taux-io/official-website/commits/<sha>/check-runs \
  --jq '[.check_runs[] | select(.app.slug=="cloudflare-workers-and-pages")] | length'
```

`1` 表示真的有建置，而且大約一分鐘內就會出現。`0` 表示沒有。

**dashboard 的畫面不是證據。** 2026-07-29 為了移除重複部署路徑而斷開它時，前兩次 dashboard 都顯示已斷開，而接下來的推送它照樣為每個 commit 建立新的 build。判準只有推送。

### 曾經失敗一整天的原因

那段期間整合是連著的、但**建置指令欄是空的**，所以 `npm ci` 之後直接跑 deploy command，`dist/` 從未被產生：

```
✘ [ERROR] The directory specified by the "assets.directory" field
  does not exist: /opt/buildhome/repo/dist
```

當時的診斷一度假設成因是「映像沒有 `cargo`」——那個假設完全合理卻是錯的，它連需要 cargo 的那一步都沒走到。第 3.2 節那串建置指令同時解決了兩件事：空指令，以及映像確實沒有 cargo。

先前的計畫是 Cloudflare Pages。**那一步從來沒有真的走完，Pages 專案不存在**——不需要停用或刪除任何 Pages 專案。理由見 NOTES.md〈為什麼是 Workers 而不是 Pages〉。

---

## 2. 建置

```bash
npm ci
npm run build:css && npm run build:site
```

輸出在 `dist/`。

建置需要 Rust toolchain。版本不要自己選，repo 裡釘好了：`rust-toolchain.toml`（channel 1.90）與 `.nvmrc`（Node 22）。rustup 會自己讀前者，`actions/setup-node` 與 `nvm` 會讀後者。

**上線用的建置發生在 Cloudflare（Workers Builds），不在 GitHub Actions。** CI 仍然會建置，但那份產物只用來跑檢查，不會被部署——上線的是 Cloudflare 自己 clone、自己建出來的那一份。

**Cloudflare 的建置映像沒有 `cargo`**，它偵測到的只有 Node 與 npm。所以建置指令必須自己裝 rustup，那一整串記在第 3.2 節，且必須與 dashboard 裡的值逐字一致。

---

## 3. 一次性設定

這三步只做一次。做完之後推送到 `main` 就會自動建置並上線（第 4 節）。

### 3.1 Worker 已經存在

Worker `taux-io` 已於 2026-07-29 以 `wrangler deploy` 建立於帳號 `taux.io`（`5164de0801b523f919f7a9eac9bbf9bf`）。這一步是必要的引導：**`wrangler versions upload` 無法對尚不存在的 Worker 執行**，所以第一次必須是 `deploy`。

它目前**沒有任何對外網址**——`workers_dev` 是 `false`，也還沒接任何 route，`wrangler deploy` 回報 `No targets deployed`。也就是說它已經存在、已經驗過，但還沒有人能連到它。這是刻意的：切換是第 5 節，不是這一步的副作用。

若日後需要在別的帳號重建：

```bash
npx wrangler deploy      # 只有第一次，用來讓 Worker 存在
```

### 3.2 接上 Workers Builds，並填入這兩段指令

Workers & Pages → `taux-io` → 設定 → 建置 → **Connect**，選 `taux-io/official-website`，production branch `main`。

接著填入這兩格。**它們是這份 runbook 的一部分，改 dashboard 就要同步改這裡**——實際生效的值活在後台，這是這個做法明確接受的代價（見 NOTES.md）。

**Build command**（一整行，含 rustup 安裝）：

```
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --no-modify-path && . "$HOME/.cargo/env" && npm run build:css && npm run build:site
```

**Deploy command**（用於 production branch，也就是 `main`）：

```
npx wrangler deploy
```

**Non-production branch deploy command**（用於 PR 分支，dashboard 的摘要頁把它顯示為 `Version command`）——**同一串**：

```
npx wrangler versions upload
```

其餘欄位：Production branch `main`、Builds for non-production branches **啟用**、Root directory `/`、Build watch paths `*`、Build cache **停用**。

四件事不能弄錯：

- **Build command 不可留空。** 空著就是 `npm ci` 之後直接跑 deploy command，`dist/` 從未被產生，建置必然失敗於 `assets.directory ... does not exist`。這個錯誤實際發生過一整天。
- **那兩格 deploy command 不要填反，而且它們不一樣。** production 那格是 `wrangler deploy`（上線），非 production 那格是 `wrangler versions upload`（只上傳）。只填非 production 那格的話，PR 分支會上傳版本而推 `main` 什麼都不做——正好是想要的相反。這實際發生過一次。
- **不需要 `npm ci`。** Workers Builds 會自己跑 `npm clean-install`，建置指令從 `build:css` 開始就好。
- **`wrangler deploy` 會套用 triggers，那是刻意的也是安全的。** `wrangler.jsonc` 宣告了 `taux.io` 與 `www.taux.io` 兩個 custom domain，每次部署都會重新套用。2026-07-29 從 CLI 第一次嘗試時這一步撞過 409 Conflict，因為當時 DNS 還指向舊的 Go 主機；域名接上這個 Worker 之後重複套用是等冪的，實測回報 `Deployed taux-io triggers` 而非衝突。**如果它哪天又開始 409，每一次建置都會失敗**，成因會在 DNS 而不在這裡。

**Build cache 停用是刻意的。** 它只快取 npm／yarn／pnpm／bun 的套件目錄與特定框架的輸出——**不快取 Rust／cargo 產物，也不快取 `~/.cargo`**。這個專案的耗時集中在 rustup 安裝與 generator 的冷編譯，那兩項它都幫不上；而且快取在 7 天未讀後就會被清除，以這個站的推送頻率大多是冷的。

不需要 API token。Workers Builds 用的是它自己的 Git 整合憑證，GitHub 的 repo secret 裡**不應該有** `CLOUDFLARE_API_TOKEN`——若還留著，那是先前從 GitHub Actions 部署時的殘留，可以刪除。

### 3.3 開啟 zone 層的 HSTS

`Strict-Transport-Security` 設在 SSL/TLS → Edge Certificates → HTTP Strict Transport Security，**不在 `_headers` 裡**。切換前的 Go 主機送的是 `max-age=31536000`，設成同值或更長。

契約測試會斷言它，但只有在 `BASE_URL` 指向 `https://taux.io` 時做得到（zone 設定不會套用到 preview URL）。取捨的理由記在 NOTES.md。

---

## 4. 每次部署怎麼走

**兩件事平行發生，而且它們互不相依。**

`.github/workflows/checks.yml` 在 PR 與推送 `main` 時跑：

1. `build` job：cargo fmt / clippy / test、建置、樣式表新鮮度、class 可解析、llms.txt 完整、日期一致、結構化資料有效
2. `audit` job：用 `npm run serve`（`wrangler dev`，會套用 `_headers`）供應輸出，跑對比稽核與路由契約測試

Workers Builds 在推送 `main` 時 clone、建置、`wrangler deploy`——**直接上線**。合併就是上線。

PR 分支則跑 `wrangler versions upload`，產生一個不承載流量的版本與一個 preview URL，那是合併前可以實際看一眼的地方。

### 這裡沒有自動的上線關卡

**擋在 production 前面的是 PR 階段的 CI，不是部署流程。** 一個改動要進 `main` 必須先通過 build 與 audit，包含 156 條路由契約斷言與 1475 個元素的對比稽核。合併之後就沒有第二道門了。

先前 GitHub Actions 的做法是 `upload → 拿 preview URL → 跑契約測試 → 通過才推`，**壞的版本到不了訪客**。Workers Builds 的建置流程裡跑不了 Playwright、也拿不到剛建立的 preview URL，所以那一步搬不過來。中間曾改成手動推廣來保留把關，但那讓每次改動都要一個人執行一行指令——**一個每次都要人做的步驟，遲早會變成沒人做的步驟**，所以換成自動上線加上 PR 把關。

**這個安排真正的代價有兩個，都不會自己浮現：**

- **上線的產物沒有被驗過。** CI 建置並跑完整檢查，但那份產物不會被部署；上線的是 Cloudflare 自己 clone 後建的。同一個 commit、同一組釘死的 toolchain，理論上相同——**但沒有任何東西在比對它們**。
- **zone 層的東西仍然只能事後驗。** HSTS、www 轉址、以及 Cloudflare 注入的分析 beacon 都不在 preview URL 上生效。這一類缺陷在 CI 全綠時完全看不到——2026-07-30 那個被 CSP 擋掉的 beacon 就是這樣藏了一天。**所以第 6 節那段對 production 的驗證不是儀式。**

---

## 5. 切換：把 `taux.io` 指過來

**三步都已於 2026-07-29 完成。** 步驟保留在這裡是因為它們是重建這個拓撲的依據，不是因為還沒做。

**這一段是不可逆的、會影響現有流量的動作。** 它只在重建這個拓撲時需要——日常部署不碰域名，`wrangler deploy` 每次重新套用的是已經存在的同一組 trigger。

1. **接上 custom domain。** Workers & Pages → `taux-io` → Settings → Domains & Routes → Add custom domain：`taux.io`。Cloudflare 會改寫該 zone 既有的 DNS 記錄指向 Worker。

   **第一次接上必須用 dashboard，不能用 `wrangler deploy`。**（之後就沒這個限制——見第 3.2 節，域名接上之後每次部署重新套用是等冪的。）`wrangler.jsonc` 的 `routes` 已經宣告了這兩個 hostname，但在 DNS 還指向別處時從 CLI 套用會失敗：

   ```
   PUT .../workers/scripts/taux-io/domains/records → 409 Conflict
   ✘ Some triggers failed to deploy for taux-io
   ```

   當時 `taux.io` 與 `www.taux.io` 都有代理中的 A 記錄指向 Go 主機，而 Cloudflare 不會在 API 呼叫裡默默覆寫既有記錄。dashboard 的流程會顯示衝突並讓你確認覆寫——那個確認正是 409 缺的東西，而且覆寫是原子的。先刪 DNS 記錄再從 CLI 接也可以，但那會有一段兩邊都不通的空窗。

   這是**安全的失敗**：2026-07-29 實際撞過一次，Worker 的內容照常部署，只有 triggers 沒套用，線上服務完全未受影響。

2. **同樣接上 `www.taux.io`**，或不接而直接做下一步——兩者都可以，重點是 www 不能繼續指著舊的 Go 主機。
3. **建立 www → apex 的 301。** Rules → Redirect Rules，來源 `www.taux.io/*`，目標 `https://taux.io/$1`，狀態 301。
   **不要試圖寫在 `_redirects` 裡**：Cloudflare 的 `_redirects` 來源端只接受路徑，明文不支援域名層級轉址。
   目標一定要帶 `$1`。丟掉路徑的規則會把每一條已索引的 www URL 全部送到首頁，而且只測 `/` 的時候看起來完全正確——契約測試因此同時對 `/` 和 `/geo-guide` 斷言。
4. **跑第 6 節的驗證。**
5. **移除 taux.io 在舊主機上的那一份。已於 2026-07-29 交給該機器的管理者處理，不在這個 repo 的範圍內。**

   **不要收掉那台機器**——它用 nginx-proxy 同時代管其他網站，關掉會弄壞跟這個專案無關的東西。要移除的只有 taux.io 專屬的容器，它是這樣起的（來自已刪除的 `deploy.prod.sh`）：

   ```
   --env "VIRTUAL_HOST=taux.io,www.taux.io"
   --env "LETSENCRYPT_HOST=taux.io,www.taux.io"
   taux-website-prod:latest
   ```

   容器移除後那兩個環境變數就不存在，nginx-proxy 會自動撤掉該 vhost、acme-companion 停止續約。**續約這件事是有時效的**：DNS 已經指向 Cloudflare，HTTP-01 challenge 到不了那台機器，所以留著只會無限重試失敗。

---

## 6. 切換後驗證

**第 5 節做完一定要跑這一段。** 這裡驗的是**主機與 zone 的行為**——內容在 CI 就驗過了。

```bash
npm ci
npx playwright install chromium
BASE_URL=https://taux.io npm run contract
```

對 production 跑的時候，契約測試會**額外**做三項只有在這裡做得到的斷言（因為它們設在 zone，不在這個 repo 部署的東西裡）：HSTS 存在且 `max-age` 夠長、`www.taux.io/` 301 到 `https://taux.io/`、`www.taux.io/geo-guide` 301 到 `https://taux.io/geo-guide`。

指向非 production 的每一次執行都會印出 `NOT ASSERTED` 區塊列出這些項目，所以 `0 failing` 不會被誤讀成「全部都檢查過了」。

對比稽核可以一起跑：

```bash
BASE_URL=https://taux.io npm run contrast
```

不想裝瀏覽器的話，最低限度用 curl：

```bash
curl -sI https://taux.io/ | grep -i 'content-security-policy\|strict-transport-security\|^HTTP'
curl -sI https://taux.io/static/fonts/D-DIN.woff2 | grep -i 'cache-control'   # 只能有一個 max-age
curl -s  -o /dev/null -w '%{http_code}\n' https://taux.io/no-such-page        # 必須是 404
curl -s  -o /dev/null -w '%{http_code} %{redirect_url}\n' https://taux.io/geo-guide  # 200，無轉址
curl -sI -o /dev/null -w '%{http_code}\n' https://taux.io/                    # 必須是 200，不是 404
curl -s  -o /dev/null -w '%{http_code} %{redirect_url}\n' https://www.taux.io/geo-guide  # 301 到 apex 同路徑
```

---

## 7. 主機必須做對的四件事

這四件都出過錯，四件都不會在 HTML 裡顯示出來。**四件都已在真實邊緣量測通過**（2026-07-29，對已上傳的版本），但改動 `wrangler.jsonc` 或 `_headers` 時要維持它們。

**`_headers` 必須被套用。** 安全標頭與 CSP 全部在這個檔案裡，隨 `dist/` 一起部署。它們曾經在一個從未進入運行拓撲的 `nginx.conf` 裡，被 README 宣稱了好幾個月而一次都沒送出過。所以驗證的方式是**看回應帶回來的值**，不是確認檔案存在。

**`_headers` 的規則必須互不重疊。** Cloudflare 會**合併**所有符合的規則，不是最具體的勝出——Workers 與 Pages 在這點行為一致。`/static/*` 與 `/static/fonts/*` 同時命中，字體會拿到 `max-age=3600, max-age=31536000`，瀏覽器取第一個。這已經發生過一次，現在的規則是互斥的，改它的時候要維持這件事。

**未匹配路徑必須回 404 狀態，而且是本站的 404 文件。** `wrangler.jsonc` 的 `not_found_handling: "404-page"` 負責這件事。**不設它狀態碼也會是 404**——但送出的是 Cloudflare 自己的純文字錯誤頁，不是這個站的 `404.html`。狀態碼是爬蟲讀的，body 是人看的，契約測試兩件都斷言。

**檔案是扁平的 `.html`，不要改動 `html_handling`。** 現值 `auto-trailing-slash` 讓 `geo-guide.html` 在 `/geo-guide` 直接供應。若改成把它當目錄，`/geo-guide` 會 308 到 `/geo-guide/`——每一條已索引的 URL 多一跳，而 canonical 指向主機不直接服務的形式。

---

## 8. 回滾

建置產物是純靜態檔案，沒有資料遷移、沒有狀態。

Cloudflare 保留每一個上傳過的版本：

```bash
npx wrangler versions list        # 最近 10 個版本
npx wrangler deployments status   # 現在 production 是哪一個
npx wrangler rollback <version-id> --message "為什麼"
```

`wrangler rollback` 不重新建置、不重新上傳，直接把 production 指回一個已經存在的版本——所以它比「revert 再等一輪 CI」快，適合止血。

止血之後，正常流程仍然是修 → 合併到 `main` → 自動部署；`main` 上每個 commit 都經過 `build`、`audit`，以及對即將上線的版本跑的契約測試。

**注意：回滾不會回滾 zone 設定。** HSTS、www 轉址、custom domain 都不在版本裡（見第 3 節與第 5 節）。那些要在 Dashboard 改回去。

---

## 9. 部署方需要知道、但不在這份文件裡的事

- **CI 已經驗過的東西不需要在切換時重驗**：每個進 `main` 的 commit 都跑過對比稽核（1475 個文字元素、0 個低於 WCAG AA）與契約測試，而且契約測試還對即將上線的那個版本在真實邊緣再跑一次。第 6 節要驗的是**zone 的行為**，不是內容。
- **建置不讀 git。** 頁面日期宣告在 `site.toml`，所以淺層 clone 不影響任何輸出。先前的版本會讓每次部署把全站每一頁的修改日期蓋成部署當天——包括改個 README 錯字觸發的那次。
- **沒有機密，執行期或建置期都沒有。** Workers Builds 用它自己的 Git 整合憑證，這個 repo 不需要任何 secret。若 Worker 的設定裡出現任何 binding、變數或機密，那是誤加的。
- **沒有 `*.workers.dev` 網址。** `workers_dev` 設為 `false`：整個站掛在第二個永久網域上，等於每一頁都有一份 canonical 指向別處的完整複本。per-version 的 preview URL 仍然開著，推廣之前可以用它看一眼；它們不公開列出且每個版本都不同。
