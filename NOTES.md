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

**設計的唯一來源是 [DESIGN.md](DESIGN.md)。** 顏色、字體、字距、圓角、間距、元件、動態與版面的實作約束全在那裡。

這一節以前有一份 token 表與六條「不明顯的決定」。它們搬走了，不是刪掉——留在這裡的第二份描述會和 DESIGN.md 漂移，而這份文件開頭就寫著三代設計描述並存時沒有一段有效。要改設計規則，改 DESIGN.md。

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
npm run check:design   # 模板是否牴觸 DESIGN.md（CI 閘門）
npm run check:entity   # 建置產物的實體宣告與 @id 圖（CI 閘門）
npm run check:entity:links  # sameAs 的 URL 是否解析得到（CI 閘門，需網路）
npm run dates          # 宣告的日期 vs git 認為的（僅報告）
npm run screenshot <label>   # 截圖到 .visual/<label>/
npm run diff <a> <b>         # 像素比對
```

`.github/workflows/checks.yml` 在 PR 與推送 main 時跑兩個 job。**`build`**：`cargo fmt` / `cargo clippy` / `cargo test` / `build:site` / `check:css` / `check:classes` / `check:llms` / `check:dates` / `check:jsonld` / `check:design` / `check:routes` / `check:entity`。**`audit`**：安裝 chromium、建置、用 `npm run serve` 供應，然後 `contrast` / `contract` / `geometry` / `check:entity:links`。

**需要瀏覽器或網路的都在 `audit`，離線的都在 `build`。** 前兩者跑在 wrangler 供應的 `dist/` 上，因為只有 wrangler 會套用 `_headers`——用一般靜態伺服器驗，一條永遠匹配不到的標頭規則看起來完全正常。

**十二道**閘門的門檻都設在「乾淨」而非「不要更糟」，趁現在乾淨時設，才不需要維護一份豁免清單。

⚠️ **這個數字之前是錯的，而錯的方式值得記住。** 它寫「九道」的時候實際上有十道——`check:routes` 落地時沒有進這份清單，於是有人（我）照著這裡數，在 PR 上公開宣告「九道閘門全綠」。**文件與 CI 分歧時，綠的是 CI，錯的是宣告。** 現在是十二道：下面九道加上 `check:css`、`check:routes`、`geometry`。改 `checks.yml` 時請一併改這裡。

- **contrast** —— 0 隱形元素、0 不符 WCAG AA
- **contract** —— 每條路由的狀態碼、`lang`、canonical、分享圖、結構化資料、**所有引用資產（含 manifest 裡的圖示與 CSS 裡的字體）**、CSP 違規、JS 錯誤、`/` 的語言協商（只在 `BASE_URL` 指向 production 時）
- **geometry** —— 八個寬度下的水平溢出、圓角、44px 觸控目標，以及依 locale 而定的行長上限
- **check:css** —— 已提交的 `styles.min.css` 與目前的模板一致
- **check:routes** —— 已發布的路徑與 `published-paths.txt` 這份 ledger 相符，退役的路徑仍在 `[[redirect]]` 裡
- **check:classes** —— 沒有任何類別產生不出 CSS
- **check:llms** —— 每一個已發布的頁面都在 llms.txt 裡
- **check:dates** —— 每頁都宣告日期，沒有未來日期，發布日不晚於修改日
- **check:jsonld** —— 結構化資料有效，且沒有重複鍵（`JSON.parse` 看不到重複鍵，它會靜靜取最後一個）
- **check:design** —— 模板不牴觸 `DESIGN.md`。讀作者寫下的意圖，不解析 CSS 產物
- **check:entity** —— 讀**建置產物**的實體宣告，五條規則：每個 `@id` 引用都有節點、全站只有一個 Organization 身分、title 與 description 用**該 locale 的書寫系統**（決策 #56 之前是「含中文」，那在五個 locale 之後不成立）、圖裡的 taux.io URL 指向本頁的 locale、`inLanguage` 說實話（決策 #61）。它讀 `dist/` 而不是 `templates/`，因為 `@id` 圖只有在 include 組合完成後才成形
- **check:entity:links** —— `sameAs` 的 URL 解析得到。只抓硬性 404；登入牆後面的軟性 404（Facebook 對不存在的頁面回 200）抓不到，那仍然是人的判斷

**`check:entity` 會拒絕稽核不完整的 `dist/`。** 建置是一頁一頁寫的，遇到第一個解析不了的模板就結束，所以失敗的建置會留下半棵樹——而所有讀 `dist/` 的檢查都會對著它報綠。這實際發生過：一個壞掉的 include 讓十七頁只寫了八頁，三條規則全部「通過」。它現在會比對 `site.toml` 宣告的頁數。

截圖與像素比對刻意不設為閘門：跨機器的字體渲染差異會產生假警報，它們是給人看的工具。

### 寫捲動斷言時，`scroll-smooth` 會讓探針說謊

`<html>` 掛著 `scroll-smooth`，所以 `window.scrollTo(...)` 是動畫的。**在動畫開始之前讀位置，拿到的是捲動前的值**，而那個值看起來完全像是一個合理的失敗。

同一個陷阱在一次工作裡踩了兩次：先讓人以為 `position: sticky` 失效，再讓人以為錨點連結在無 JS 時跳不動。兩次都是探針錯，不是頁面錯。

任何捲動斷言必須擇一：用 `behavior: "instant"`，或等動畫跑完。而**在下結論說某個東西壞掉之前，先確認量測本身是對的**——一個符合預期的失敗最不容易被追究。

### `styles.min.css` 是進版控的建置產物

Tailwind 掃描模板產生它，所以**改完模板沒重建就會靜默失效**——曾經發生過，`.md:h-20` 沒進去，七個頁面的曲線細帶少了 16px 而毫無跡象。`npm run check:css` 就是為此存在。

### `?v=` 版號是手動的

`header.html` 和 `footer.html` 引用 CSS/JS 時帶著 `?v=N`。**改了那些檔案就要遞增它，沒有任何東西會提醒你。** 也因為如此，CSS/JS 的 `Cache-Control` 只給一小時而非 immutable——押注在人的記性上，代價是使用者永久卡在舊版且無法復原。

---

## 怎麼把一批工作切開與落地

一份 spec 一支分支一個 PR。票是**落地順序**，不是各自的 PR——這個 repo 合併就是上線，PR 越少、驗證的次數就越集中。

**只在有決策點的地方切票。** 判準是：這張票結束時，有沒有人要看著結果做一個決定？沒有就別切。曾經把「十條風險內容」拆成上下五條，實作時被併回同一個 commit——五要素的形狀在第一條就定死，後九條是照抄，中間沒有任何值得停下來的地方。

**前置重構獨立一張，排最前面。** 一條新的檢查規則若先落地，後面寫的東西就天生受它保護；合進使用它的那張票，它就從「讓錯誤不可能發生」退化成「事後稽核」。

**新檢查器帶著關閉狀態落地，由讓它成立的那張票開啟**，並在程式碼裡具名寫出票號。這樣 CI 一路綠燈而不需要豁免清單——用關掉規則換綠燈和用豁免清單換綠燈是同一件事，差別只在前者誠實。`check:design` 與 `check:entity` 都是這樣落地的。

**骨架票要含一個決定，否則只是延後。** 「頁面先存在、內容之後補」本身沒有價值；有價值的是在那張票裡把**後續工作依賴的東西定死**——例如章節 id。定死了，做索引的人就不必等內容寫完。

### 兩份 spec 同時進行時，多開一張整合票

各自全綠不代表合併後成立。曾經有兩支分支分別通過全部閘門，合併後建置直接失敗：一支新增的頁面引用了另一支刪掉的 partial。git 兩邊都乾淨合上，因為一邊是新檔案、一邊是乾淨的刪除。

**沒有任何一張票會抓到這種問題**，因為每張票的驗收條件都只看自己那支分支。所以只要同時有兩份 spec 在跑，就開一張整合票，驗收條件寫死：**在合併結果上**跑完全套閘門。合併前先做一次試合併，不要等到合併時才發現。

這是範圍問題不是粒度問題——調票的大小補不起來。

### 有時效的前提要用機制擋，不能只寫字

曾經有一張票要求「必須在任何改動上線之前完成」，理由充分且不可逆（它是一次量測的對照組）。那個限制寫進了票的 Blocked by，也寫進了 PR 說明，然後被一句口頭指示蓋過去，對照組永久消失。

**它從頭到尾只是散文，沒有任何東西會擋。** 真的不能先合併的東西，要用 draft PR、required review、或乾脆不推分支。把不可逆的前提交給文字去守，它就守不住。

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

換掉的理由是 `versions upload`：它會發佈一個版本並給出 preview URL，**但不導任何流量過去**。Pages 沒有這個形狀的東西，而它是切換那幾天唯一能對「即將上線的東西」跑完整契約測試的地方。

日常部署已經不用它了（合併即上線），但手動要驗一個尚未上線的版本時，它仍然是唯一的辦法。

`_headers` 在兩者的行為一致，包括**合併**而非最具體者勝出——所以下面那條互不重疊的紀律原封不動繼續有效。

### 建置為什麼從 GitHub Actions 搬回 Cloudflare

2026-07-29 的第一版把建置與部署都放在 GitHub Actions，理由寫得很硬：Cloudflare 的建置映像沒有 `cargo`，所以走它的整合就得在指令欄塞一串 rustup 安裝；而且 CI 驗過的產物跟上線的產物不是同一份。

**兩個理由到今天都還成立，是取捨的權重改了。** 決定是把部署收斂到單一供應商，接受那兩個代價，換掉「維護一組 API token、一個 deploy job、以及兩個系統之間的接縫」。

代價要說清楚，因為它們不會自己浮現：

- **自動的上線關卡沒有了。** 先前 CI 的流程是 `upload → 拿 preview URL → 跑 156 條契約測試 → 通過才推`。Workers Builds 的建置流程裡跑不了 Playwright、也拿不到 preview URL 去測，更沒有「檢查失敗就不推」的機制。

  中間曾用手動推廣來保留把關——版本上傳後不自動上線，由人執行 `wrangler versions deploy`。那撐了不到一天就換掉了：**一個每次改動都要人做的步驟，遲早會變成沒人做的步驟**，而它守的是一道本來就只在 CI 全綠之後才會遇到的門。現在 production branch 的 deploy command 是 `wrangler deploy`，合併即上線，把關全部落在 PR 階段。
- **上線的產物沒有被驗過。** CI 仍然建置並跑完整檢查，但那份產物不會被部署；上線的是 Cloudflare 自己 clone 後建的。同一個 commit、同一組釘死的 toolchain 版本，理論上相同——**但沒有任何東西在比對它們**。

保留 GitHub Actions 的 `build` 與 `audit` 是這個決定的另一半：PR 階段的閘門一個都沒少，少掉的只有 `deploy` job。

### 為什麼 HSTS 不在 `_headers` 裡

`Strict-Transport-Security` 設在 Cloudflare zone（SSL/TLS → Edge Certificates），不在 `_headers`。這是刻意的取捨，也**違反**本文件其他地方的偏好（政策要在 repo 裡），所以記在這裡：zone 設定涵蓋整個網域而不只這個 Worker 供應的路徑。

代價是真的：它重蹈了「設定活在後台、無法在 review 裡看到」這個這個專案被咬過的模式。緩解方式是契約測試**照樣對回應斷言它**——但只有在 `BASE_URL` 指向 `https://taux.io` 時才做得到，因為 zone 設定不會套到 preview URL。所以這一項對 preview URL 驗不到，只能對 production 驗。契約測試會在沒做這些斷言的每一次執行印出 `NOT ASSERTED`，避免「0 failing」被讀成「全部都檢查過了」。

www → apex 的 301 同理，設在 zone 的 Redirect Rule。**不是**寫在 `_redirects` 裡——Cloudflare 的 `_redirects` 來源端只接受路徑，明文不支援域名層級轉址。

### `/` 的語言協商，以及那個欄位讀不到

`/` 依 `Accept-Language` 送人去對應的 locale，設在 zone 的 Redirect Rules（Rules → Redirect Rules）。與 HSTS 同一個代價、同一個緩解：設定活在後台，契約測試只能對 production 斷言。

**計畫裡假設可以用的欄位不能用。** `http.request.accepted_languages` 是 Cloudflare 幫你解析並依 `q=` 權重排好序的陣列，正是這件事要的東西——但它的文件寫明「only available in Transform Rules」。Redirect Rules 看不到它，只看得到生的 `http.request.headers["accept-language"]`。

繞法是對生字串比對前綴，而它成立的理由要寫清楚：**瀏覽器送出的 `Accept-Language` 本來就依偏好排序**，`q=` 只用在後段。所以生字串的開頭就是使用者的第一順位，`starts_with` 拿到的答案和解析過的欄位一樣。**不一樣的情況**：客戶端亂序、或第一個標籤是 `*`。那是 302，猜錯的代價是一次跳轉，不是一個被記住的錯誤。

規則依序，第一個命中的贏：

| # | 條件（`http.request.uri.path eq "/"` 之外） | 目的地 |
|---|---|---|
| 1 | `starts_with "zh-CN"` 或 `"zh-Hans"` 或 `"zh-SG"` | `/zh-Hans-CN` |
| 2 | `starts_with "zh"` | `/zh-Hant-TW`（含 `zh-TW`、`zh-HK`、`zh-MO`、裸 `zh`） |
| 3 | `starts_with "en"` | `/en-US` |
| — | 都不命中 | 落到 `_redirects` 的 `/ /zh-Hant-TW 302` |

**簡體那條必須排在裸 `zh` 前面**，否則 `zh-CN` 會先被第 2 條吃掉。

全部用 **302**，包含落底的那條。bot 豁免因此不需要寫成 User-Agent 判斷：爬蟲多半不送 `Accept-Language`，不命中就落底到正典 locale，這正是決策 #59 要的結果。**而且狀態碼對誰都一樣**——如果 bot 拿 301、人拿 302，那是依 User-Agent 給不同回應，離 cloaking 只差一步。同一個 302、不同目的地、由請求標頭決定，是標準的內容協商。

⚠️ **`/` 曾經是 301，而且已經快取在訪客的瀏覽器裡。** 上面那段設計寫在 `site.toml` 的註解裡，但那筆 `[[redirect]]` 沒寫 `status`，於是跟其餘二十條一起吃了 301 的預設值。**註解是設計，資料是上線的東西。** 已改成 302，但改不掉別人瀏覽器裡已經存著的那一份——那些人不會再問，直接去 `/zh-Hant-TW`。這是這個缺陷真正的代價，也是為什麼它值得單獨修一次而不是等階段 ③。

### 切換期間壞掉的四件事

四件都是「看起來成立、實際不成立」，而且第一版的檢查都放行了它們。記在這裡是因為每一件的**檢查方式**才是教訓，不是那個設定本身。

後三件是同一個形狀：**一個合理的假設在證據還不足時就被寫成了結論。** 合理是它們危險的原因——不合理的假設會被追究。

**`${{ runner.temp }}` 不能寫在 job 層的 `env`。** `runner` context 只存在於 step。放在 job 層不是某個 step 失敗——GitHub 在建立任何 job **之前**就拒收整份 workflow，於是 run 在 0 秒內失敗、沒有 log、`gh pr checks` 回報「沒有任何 check」。那個空白很容易被讀成「CI 還沒開始跑」。

放行它的檢查是一段 regex，掃檔案找 job 名稱——它把 `on:` 底下的 `pull_request` 和 `push` 也報成了 job。那個明顯錯誤的輸出當下沒有被追究。**YAML 要用解析器驗，不是用 regex 掃**；現在的做法是真的 parse 出 `jobs` 的 key，並掃描每個 job 層 `env` 有沒有用到 step-only 的 context。

**Workers Builds 的失敗不是缺 `cargo`。** 當時的假設是「Cloudflare 的建置映像沒有 Rust」，因為那正是離開 Pages 的理由，聽起來完全合理。實際 log 顯示它根本沒設建置指令：`npm ci` 之後直接跑 `wrangler versions upload`，所以 `dist/` 從未被產生，連需要 `cargo` 的那一步都沒走到。

教訓不是那個成因，是**一個符合既有敘事的假設最不容易被查證**。log 一直都拿得到，只是沒去讀。

**「非 production 分支不會建置」也是同一種誤判。** 四次分支建置都失敗於 `assets.directory ... does not exist`，於是被歸納成「Build command 只在 production branch 執行」，還據此寫進 runbook 說應該關閉分支建置。

實際上那四次全部發生在組建命令那格生效之前——**成因是設定沒填好，跟分支類型無關**。四個資料點全部落在同一個混淆變數的同一側，而當時沒有任何一個對照組。推翻它只需要一次乾淨的觀察：設定修好之後，分支建置在 `00:21:06` 成功，一個版本在 `00:21:03` 產生。

這一次的分辨方法不是「多想一下」，而是**問這批證據裡有沒有對照組**。四次失敗全都來自同一個壞掉的設定，那不是四個證據，是一個。

**而更正本身漏了一半。** 推翻那個結論的那次改動改寫了 `DEPLOYMENT.md` 第 4 節的推理，卻留下兩處從舊結論長出來的**指示**：設定清單那一行仍寫著把分支建置「停用（理由見第 4 節）」——指著一段現在說相反話的章節——而非生產分支部署命令那格仍被描述成「留空或留著都無所謂，因為建置已經關閉」。照著清單做的人會關掉分支建置，而合併之後沒有第二道門，那是唯一能在改動抵達訪客之前打開來看的地方。

**改掉一個結論的時候，要一起找出所有依它寫成的祈使句。** 推理段落是給人讀懂的，檢查清單是給人照做的，而照做的那份才會真的改變設定。分辨方法很機械：把被推翻的說法當關鍵字全文搜一次，看還有誰在引用它。

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

### 但有一類缺陷只有「瀏覽器 + production」看得到

2026-07-30 對 production 跑完整契約測試，14 條路由**每一條都失敗**，全是同一件事：CSP 擋掉 `https://static.cloudflareinsights.com/beacon.min.js`。

那個腳本不在 `dist/` 裡，也不在 `templates/` 裡。**是 Cloudflare 在邊緣注入的**——Web Analytics 對「代理中的網站預設開啟」，沒有人打開過它。而且它只注入給帶完整瀏覽器標頭的請求：

```
瀏覽器收到的 HTML   含 cloudflareinsights = true
curl 收到的 HTML    含 cloudflareinsights = false（位元組等同 dist/index.html）
```

**是切換造成的。** 舊的 Go 主機根本沒送 CSP，所以 beacon 一直正常載入；讓 CSP 真的生效之後它就被擋了。處置是在 zone 關掉 Web Analytics（Web Analytics → Manage Site → Disable），而不是把第三方來源加進 `script-src`。

真正值得記的是**它同時避開了每一道既有的檢查**：

| 檢查 | 為什麼看不到 |
|---|---|
| `curl` 那組最低限度驗證 | 注入不會發生，curl 拿到的 HTML 跟建置產物逐位元相同 |
| CI 的對比稽核與契約測試 | 跑在 `wrangler dev` 上，本機不經過 Cloudflare 邊緣 |
| 任何對 preview URL 的檢查 | preview URL 在 `workers.dev`，**不在 `taux.io` 這個 zone 裡**，zone 層功能一概不生效 |
| 任何不開瀏覽器的驗證 | 它是 CSP 違規，只有渲染頁面時才會發生 |

所以「對 production 跑一次完整契約測試」不是儀式。**這一項在別的地方一次都看不到**，而它在瀏覽器啟動後幾分鐘內就被抓到。

這也是 `scripts/browser.js` 存在的理由：Playwright 自帶的 Chromium 在某些機器上下載不下來，而那會讓四個視覺工具全部無法使用——這個缺陷就是在那種狀態下藏了一整天。`PLAYWRIGHT_CHANNEL=chrome` 改用系統已安裝的瀏覽器，不設就是原本的行為。

```bash
PLAYWRIGHT_CHANNEL=chrome BASE_URL=https://taux.io npm run contract
```

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

- `?v=` 版號手動遞增（見上）
- Windows 中文渲染品質低於 macOS（見上）
