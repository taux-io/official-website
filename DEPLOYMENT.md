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

**不要看 GitHub 上那個檢查是不是綠的。** 2026-08-01 它在 19 次合併上全部回報 success，而其中 0 次到達訪客——version 一直在建、一直在上傳，沒有任何一個被推廣到 100% 流量。詳見 #88。

判準是**部署時間有沒有前進**：

```bash
npx wrangler deployments list | grep '^Created:' | tail -1   # 真正承載流量的
npx wrangler versions list    | grep '^Created:' | tail -1   # 只是被建出來的
```

**兩者的最新時間應該相近。** 如果 versions 在前進而 deployments 停住，就是 production branch 的 deploy command 跑成了 `versions upload` 而不是 `wrangler deploy`——第 3.2 節第二個警告講的就是這件事。

第二個判準，不需要任何憑證：

```bash
curl -s https://taux.io/ | grep -o 'styles.min.css?v=[0-9]*'
grep -o 'styles.min.css?v=[0-9]*' templates/header.html
```

兩邊不一致就是沒上線。**這比稽核可靠**——對正式站跑 contract 與 contrast 在這次失敗中是全綠的，因為它們稽核的是舊的站，而舊的站本身是正確的。一份稽核只能告訴你它看到的東西對不對，不能告訴你它看到的是不是你剛推的那一份。

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

**這三格的名字在三個地方不一樣**，而它們長得幾乎一樣、值也只差一個字——2026-08-02 就是因為認錯格子，讓部署靜靜地停了一整輪合併。對照表：

| 編輯表單（中文介面） | 編輯表單（英文介面） | 設定摘要頁 |
|---|---|---|
| 組建命令 | Build command | Build command |
| **部署命令** | **Deploy command** | **Deploy command** |
| 非生產分支部署命令 | Non-production branch deploy command | **Version command** |

**組建命令**（一整行，含 rustup 安裝）：

```
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --no-modify-path && . "$HOME/.cargo/env" && npm run build:css && npm run build:site
```

**部署命令**——**這一格決定會不會上線**。用於 production branch，也就是 `main`：

```
npx wrangler deploy
```

**非生產分支部署命令**——**必須填**，因為分支建置會跑，而且跑的就是這一格。它產出一個不承載流量的版本與一個 preview URL，那是改動抵達訪客之前唯一能實際打開來看的地方（見第 4 節）：

```
npx wrangler versions upload
```

**兩格都填成 `versions upload` 是這份設定最容易出現的錯誤形態**，因為那是連接對話框留下的預設狀態之一，而且畫面上看起來完全正常：建置成功、Workers Builds 綠燈、版本一直在建。**唯一會顯示異常的地方是第 6.1 節的判準。**

其餘欄位：Production branch `main`、Builds for non-production branches **啟用**（理由見第 4 節）、Root directory `/`、Build watch paths `*`、Build cache **停用**。

四件事不能弄錯：

- **Build command 不可留空。** 空著就是 `npm ci` 之後直接跑 deploy command，`dist/` 從未被產生，建置必然失敗於 `assets.directory ... does not exist`。這個錯誤實際發生過一整天。
- **不要把 `wrangler deploy` 填到非 production 那格。** production 那格才是 `wrangler deploy`。只填非 production 那格的話，推 `main` 什麼都不做——正好是想要的相反，而且這實際發生過一次。
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

**非 production 分支同樣會建置，而且應該保持啟用。** 它跑的是非生產分支部署命令（`versions upload`），產出一個不承載流量的版本與一個 preview URL——**合併之後就直接上線，所以那是唯一能在改動抵達訪客之前實際打開來看的地方。**

這一段先前寫的是相反的內容（「Build command 只在 production branch 執行，所以應該關閉」），依據是四次分支建置都失敗於 `assets.directory ... does not exist`。**那個歸納是錯的**：四次失敗全部發生在組建命令那格生效之前，成因是設定沒填好，不是分支與 production 的差別。時間上的巧合被當成了平台行為。推翻它的證據很簡單——2026-08-02 的分支建置在 `00:21:06` 成功，而一個版本在 `00:21:03` 被建立；組建命令沒跑的話 `dist/` 不存在，不可能有版本。

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
3. **建立 www → apex 的 301。** Rules → Redirect Rules，用**運算式**而不是 URL 形狀：匹配條件 `http.host eq "www.taux.io"`，目標 `concat("https://taux.io", http.request.uri.path)`，狀態 301。
   **不要試圖寫在 `_redirects` 裡**：Cloudflare 的 `_redirects` 來源端只接受路徑，明文不支援域名層級轉址。
   ⚠️ **這一步原本寫的是來源 `www.taux.io/*`、目標 `https://taux.io/$1`，而那個版本是壞的。** Redirect Rules 的 wildcard `*` 不匹配空字串：它匹配 `/geo-guide`，但**不匹配裸的根路徑** `https://www.taux.io/`，所以做出來的結果是所有子路徑正確轉址、首頁靜靜地繼續回 200。官方文件沒有寫 `*` 能不能匹配空字串，所以改用 hostname 當匹配條件——根路徑因此按定義包含在內，不依賴任何沒被文件化的行為。成因與更正記在 `NOTES.md`「切換期間壞掉的四件事」，**而這一格是照著舊結論寫成的祈使句，留到現在**：推理段落是給人讀懂的，檢查清單是給人照做的，改變設定的是後者。
   目標一定要接上 `http.request.uri.path`。丟掉路徑的規則會把每一條已索引的 www URL 全部送到首頁，而且只測 `/` 的時候看起來完全正確——契約測試因此同時對 `/` 和 `/geo-guide` 斷言，兩種常見的錯誤設定各有一種會被其中一條抓到。
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

## 6. 上線後驗證

**分成兩步，順序不能顛倒。** 先確認線上跑的是你剛推的那一份，再稽核它。

### 6.1 先確認「上線了沒」

**稽核回答不了這個問題。** 2026-08-01 那次失敗裡，contract 與 contrast 對正式站都是全綠的——因為它們稽核的是舊的站，而舊的站本身是正確的。**一份稽核只能告訴你它看到的東西對不對，不能告訴你它看到的是不是你剛推的那一份。**（成因與 19 次合併的紀錄見第 1 節。）

兩個判準，任一個就夠，兩個都做更好：

```bash
npx wrangler deployments list | grep '^Created:' | tail -1   # 真正承載流量的
npx wrangler versions list    | grep '^Created:' | tail -1   # 只是被建出來的
```

**兩者的最新時間應該相近。** versions 前進而 deployments 停住，就是 production branch 的 deploy command 跑成了 `versions upload` 而不是 `wrangler deploy`。

不需要憑證的版本：

```bash
curl -s https://taux.io/ | grep -o 'styles.min.css?v=[0-9]*'
grep -o 'styles.min.css?v=[0-9]*' templates/header.html
```

兩邊不一致就是沒上線。**這一項在改動沒有動到 `?v=` 時會誤報通過**，所以它是輔助而不是替代——`?v=` 是手動遞增的（見 NOTES.md）。

### 6.2 確認上線了，才稽核它

這裡驗的是**主機與 zone 的行為**——內容在 CI 就驗過了。

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
curl -s  -o /dev/null -w '%{http_code} %{redirect_url}\n' https://taux.io/zh-Hant-TW/geo-guide  # 200，無轉址
curl -s  -o /dev/null -w '%{http_code} %{redirect_url}\n' https://taux.io/geo-guide  # 301 到 /zh-Hant-TW/geo-guide
curl -s  -o /dev/null -w '%{http_code} %{redirect_url}\n' https://taux.io/           # 302 到 /zh-Hant-TW
curl -s  -o /dev/null -w '%{http_code} %{redirect_url}\n' https://www.taux.io/geo-guide  # 301 到 apex 同路徑

# bot 豁免（決策 #59 / issue #200）：200 而不是導向，且位元組與正典 locale 相同
curl -s  -o /dev/null -w '%{http_code}\n' -A 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' https://taux.io/
diff <(curl -s -A 'Mozilla/5.0 (compatible; Googlebot/2.1)' https://taux.io/) <(curl -s https://taux.io/zh-Hant-TW) && echo '位元組相同'
```

⚠️ **上面三行的期望值改過。** 這一段一度寫「`/geo-guide` 是 200 無轉址」與「`/` 必須是 200，不是 404」——那在每條路徑都還沒有 locale 前綴的時候是對的。決策 #58 之後 `/` 是 302、20 條舊路徑是 301，照舊清單做的人會看到「錯誤」並去修一個沒有壞的東西。

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

- **CI 已經驗過的東西不需要在上線後重驗**：每個進 `main` 的 commit 都跑過對比稽核（1475 個文字元素、0 個低於 WCAG AA）與契約測試。第 6.2 節要驗的是 **zone 的行為**，不是內容——而第 6.1 節驗的是**線上跑的到底是不是那個 commit**，那件事 CI 無論多綠都答不了。
- **建置不讀 git。** 頁面日期宣告在 `site.toml`，所以淺層 clone 不影響任何輸出。先前的版本會讓每次部署把全站每一頁的修改日期蓋成部署當天——包括改個 README 錯字觸發的那次。
- **沒有機密，執行期或建置期都沒有。** Workers Builds 用它自己的 Git 整合憑證，這個 repo 不需要任何 secret。若 Worker 的設定裡出現任何 binding、變數或機密，那是誤加的。
- **沒有 `*.workers.dev` 網址。** `workers_dev` 設為 `false`：整個站掛在第二個永久網域上，等於每一頁都有一份 canonical 指向別處的完整複本。per-version 的 preview URL 仍然開著，推廣之前可以用它看一眼；它們不公開列出且每個版本都不同。
