# 部署 taux.io

這份文件是部署這個網站的唯一依據。README.md 講開發，NOTES.md 記錄為什麼做了某些決定，**部署照這份做**。

網站是靜態的。執行期沒有伺服器、沒有資料庫、沒有執行期環境變數、沒有執行期機密。建置產生一個目錄，Cloudflare Workers 從邊緣供應那個目錄。`wrangler.jsonc` 裡沒有 `main`，所以沒有任何程式碼會執行。

**部署是自動的。** 推送到 `main`，CI 建置、上傳一個版本、對那個版本跑完整路由契約測試，通過才把它推成 production。人要做的只有第 3 節的一次性設定與第 5 節的切換。

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

### 還在跑但不該再跑的東西

- **Workers Builds 的 Git 整合還連著，而且每次推送都失敗。** 它沒有設定建置指令，所以 `npm ci` 之後直接跑 `wrangler versions upload`，`dist/` 從未被產生：

  ```
  ✘ [ERROR] The directory specified by the "assets.directory" field
    does not exist: /opt/buildhome/repo/dist
  ```

  **不要修它，斷開它**（Workers & Pages → `taux-io` → 設定 → 建置 → Disconnect）。要讓它成功就得在指令欄補上 rustup 安裝，那正是第 2 節說明要擺脫的東西，而且會讓兩條路徑各自建置同一份產物。它目前的 deploy command 是 `versions upload`，所以就算成功也只累積版本、不會換掉線上——但那是一個下拉選單就能改成 `deploy` 的距離。

先前的計畫是 Cloudflare Pages。**那一步從來沒有真的走完，Pages 專案不存在**——不需要停用或刪除任何 Pages 專案。理由見 NOTES.md〈為什麼是 Workers 而不是 Pages〉。

---

## 2. 建置

```bash
npm ci
npm run build:css && npm run build:site
```

輸出在 `dist/`。

建置需要 Rust toolchain。版本不要自己選，repo 裡釘好了：`rust-toolchain.toml`（channel 1.90）與 `.nvmrc`（Node 22）。rustup 會自己讀前者，`actions/setup-node` 與 `nvm` 會讀後者。

**建置只發生在 GitHub Actions。** Cloudflare 的建置映像沒有 `cargo`，先前的做法是把 rustup 的安裝塞進建置指令欄——那讓每次部署重裝一次 toolchain，而且 CI 驗過的產物跟上線的產物不是同一份。現在沒有任何一段 Cloudflare 端的建置設定要維護。

---

## 3. 一次性設定

這三步只做一次。做完之後推送到 `main` 就會自動部署。

### 3.1 Worker 已經存在

Worker `taux-io` 已於 2026-07-29 以 `wrangler deploy` 建立於帳號 `taux.io`（`5164de0801b523f919f7a9eac9bbf9bf`）。這一步是必要的引導：**`wrangler versions upload` 無法對尚不存在的 Worker 執行**，所以第一次必須是 `deploy`。

它目前**沒有任何對外網址**——`workers_dev` 是 `false`，也還沒接任何 route，`wrangler deploy` 回報 `No targets deployed`。也就是說它已經存在、已經驗過，但還沒有人能連到它。這是刻意的：切換是第 5 節，不是這一步的副作用。

若日後需要在別的帳號重建：

```bash
npx wrangler deploy      # 只有第一次，用來讓 Worker 存在
```

### 3.2 建立 API token 並放進 repo secret

CI 需要一組 token 才能上傳與推廣版本。**這是建置期的機密，不是執行期的**——網站本身仍然沒有任何執行期機密或環境變數。

在 Cloudflare Dashboard → My Profile → API Tokens 建立，權限：

| 類型 | 項目 | 權限 |
|---|---|---|
| Account | Workers Scripts | Edit |

放進 GitHub repo 的 secret，名稱必須是 `CLOUDFLARE_API_TOKEN`（`.github/workflows/checks.yml` 的 deploy job 讀這個名字）。

Account ID 不是機密，寫在 `wrangler.jsonc` 裡，不需要第二個 secret。

### 3.3 開啟 zone 層的 HSTS

`Strict-Transport-Security` 設在 SSL/TLS → Edge Certificates → HTTP Strict Transport Security，**不在 `_headers` 裡**。切換前的 Go 主機送的是 `max-age=31536000`，設成同值或更長。

契約測試會斷言它，但只有在 `BASE_URL` 指向 `https://taux.io` 時做得到（zone 設定不會套用到 preview URL）。取捨的理由記在 NOTES.md。

---

## 4. 每次部署怎麼走

推送到 `main` 之後，`.github/workflows/checks.yml` 依序做：

1. `build` job：cargo fmt / clippy / test、建置、樣式表新鮮度、class 可解析、llms.txt 完整、日期一致、結構化資料有效
2. `audit` job：用 `npm run serve`（`wrangler dev`，會套用 `_headers`）供應輸出，跑對比稽核與路由契約測試
3. `deploy` job：**相依前兩者都通過**，且只在 push 到 `main` 時執行
   - `wrangler versions upload` → 得到 version id 與 preview URL（從 wrangler 的結構化輸出讀，不是刮 console）
   - 等 preview URL 真的可供應（**版本上傳回傳的當下還不能服務**，實測過會先回一陣子 404）
   - `BASE_URL=<preview URL> npm run contract` ← **這是上線關卡**
   - 通過才 `wrangler versions deploy <id>@100`

契約測試的 canonical 一律對 `https://taux.io` 斷言，不管內容是哪個 host 送出的（`scripts/routes.js` 的 `ORIGIN`），所以對 preview URL 跑它是在驗**版本**，不是在驗主機名。

**壞的版本到不了訪客。** 這取代了先前那段人工的「上線後驗證」——那個流程只能在災難已經發生之後報告它。

---

## 5. 切換：把 `taux.io` 指過來

**第 1、2 步已於 2026-07-29 完成，第 3 步還沒。** 步驟保留在這裡是因為它們是重建這個拓撲的依據，不是因為還沒做。

**這一段是不可逆的、會影響現有流量的動作，而且不由 CI 執行。** 做之前先確認第 4 節已經跑過至少一次、production 版本是綠的。

1. **接上 custom domain。** Workers & Pages → `taux-io` → Settings → Domains & Routes → Add custom domain：`taux.io`。Cloudflare 會改寫該 zone 既有的 DNS 記錄指向 Worker。

   **要用 dashboard，不要用 `wrangler deploy`。** `wrangler.jsonc` 的 `routes` 已經宣告了這兩個 hostname，但從 CLI 套用會失敗：

   ```
   PUT .../workers/scripts/taux-io/domains/records → 409 Conflict
   ✘ Some triggers failed to deploy for taux-io
   ```

   `taux.io` 與 `www.taux.io` 現在都有代理中的 A 記錄指向 Go 主機，而 Cloudflare 不會在 API 呼叫裡默默覆寫既有記錄。dashboard 的流程會顯示衝突並讓你確認覆寫——那個確認正是 409 缺的東西，而且覆寫是原子的。先刪 DNS 記錄再從 CLI 接也可以，但那會有一段兩邊都不通的空窗。

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

對 production 跑的時候，契約測試會**額外**做三項在上線關卡裡做不到的斷言（因為它們設在 zone，不在這個 repo 部署的東西裡）：HSTS 存在且 `max-age` 夠長、`www.taux.io/` 301 到 `https://taux.io/`、`www.taux.io/geo-guide` 301 到 `https://taux.io/geo-guide`。

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
- **沒有執行期機密、沒有執行期環境變數。** 唯一的機密是 CI 用來部署的 `CLOUDFLARE_API_TOKEN`（第 3.2 節）。若 Worker 的設定裡出現任何 binding、變數或機密，那是誤加的。
- **沒有 `*.workers.dev` 網址。** `workers_dev` 設為 `false`：整個站掛在第二個永久網域上，等於每一頁都有一份 canonical 指向別處的完整複本。per-version 的 preview URL 仍然開著，那是上線關卡跑測試的地方，它們不公開列出且每個版本都不同。
