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
- **基礎設施**：Cloudflare Workers 靜態資產。唯一會執行的程式碼是 `src/worker.js`，只處理 `/` 的語言協商（見「部署」）

### 產生器的模組

| 檔案 | 內容 |
|---|---|
| `generator/src/main.rs` | 常數（`ORIGIN`、`CANONICAL_LOCALE`）、`run()` 與它拆出的五段：`render_pages`、`render_documents`、`write_sitemap`、`write_redirects`、`copy_static`；檔案系統 helper（`contained`、`copy_tree`、`content_version`） |
| `generator/src/site.rs` | site.toml 的資料模型與 `Site::derive` |
| `generator/src/markdown.rs` | Markdown 雙生檔：從 `<main>` 切出、標題與藥丸的處理、連結改寫成絕對網址 |
| `generator/src/html.rs` | 註解剝除與跳脫 |

測試跟著它測的程式碼放在各模組的 `#[cfg(test)]` 裡。

### site.toml 裡推導得出的欄位不寫

`canonical` 預設是 `https://taux.io/<locale><path>`（首頁沒有 path），locale 的 `template` 預設是：正典 locale 用路由的 `template`，其他 locale 用 `<locale>/<template>`。一百個 canonical 與八十個 template 原本都是手寫的，而且沒有一個例外，所以改成推導——**只在真的不同時才寫**。

同一條規則寫在兩處：generator 的 `Site::derive` 與 `scripts/routes.js` 的 `derivedCanonical`／`derivedTemplate`（Node 側讀 site.toml 的唯一入口）。改一邊就要改另一邊；Rust 那邊有測試釘著。

非正典 locale 缺 `template` 時，**不會**退回正典模板——那會變成翻譯的標題配原文的內文，每道閘門都綠。

### 選單與服務頁

選單由產生器組出（`Site::nav_for`）：每頁的 `section` 決定它在哪一欄（`ai`／`marketing`／`training`／`security`）或列在 `/insights`（`article`），每個 locale 只列它自己有的頁面，空的欄位不顯示。欄名是 `[locale.strings]` 的 `nav_col_<key>`，05 公司欄仍寫在 `header.html`。**選單只列服務**（2026-09 擁有者的決定）：技術文章在 `/insights`，服務頁的「延伸閱讀」連到支撐它的文章。

服務頁都是同一個形狀：開頭 `{% set %}` 五份清單（適合誰、服務內容、執行方式、交付物、FAQ），經 `_blocks.html` 的 macro 渲染；合作週期與計價是 `_service-terms.html`（三個月／半年／一年為一個週期、依個案估價——擁有者的回答），聯絡是 `_service-contact.html`。**FAQ 只寫一次**：`faq_list` 畫在頁面上，`faq_jsonld` 用 `tojson` 寫進 FAQPage（minijinja 開了 `json` feature），兩者不可能分歧。**服務頁不寫認證、合作夥伴或採購資格，也不放案例**，直到擁有者提供可查證的內容。

### 目錄

| 目錄 | 放什麼 | 發佈嗎 |
|---|---|---|
| `templates/` | zh-Hant-TW 正本與共用 partial（`_*.html`、`header.html`、`footer.html`） | 經產生器 |
| `templates/<locale>/` | 其他四個 locale 的頁面 | 經產生器 |
| `static/` | css、js、og 分享卡、brand、圖示——發佈在 `/static/` 底下 | 是 |
| `public/` | `favicon.ico`、`robots.txt`、`llms.txt`、`site.webmanifest`——**只**發佈在根目錄。產生器拒絕它覆蓋建置產物 | 是 |
| `brand-src/` | 不發佈的原始素材（`build-logo.js` 的裁切來源） | 否 |
| `ledgers/` | 閘門的記憶：`published-paths.txt`、`ko-spacing.txt`、`ko-quotes.txt` | 否 |
| `scripts/lib/` | 閘門共用的 helper：`fs.js` 的 `walk()`、`html.js` 的 `jsonLdBlocks()` | 否 |
| `scripts/design/` | `check:design` 的 `lib.js` 與 `rules/`（每條規則一個檔） | 否 |

`public/` 的四個檔案原本放在 `static/`，被整包複製之後又被複製到根目錄一次，所以每個檔案有兩個網址。舊的 `/static/…` 網址是 site.toml 裡的 `[[redirect]]`（301）。

`ORIGIN` 與 `CANONICAL_LOCALE` 在 Node 側只寫在 `scripts/routes.js`，其他腳本都從那裡取；Rust 側寫在 `main.rs`。

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
npm run build:og       # 只重生 100 張 OG 分享卡（會重寫全部；只 commit 文字有變的那幾張）
npm run contrast       # WCAG 稽核（CI 閘門）
npm run contract       # 路由對外宣告的契約（CI 閘門）
npm run geometry       # 溢出、觸控目標、行長、第一屏（CI 閘門，約 4 分鐘）
npm run cards          # 100 張分享卡的外邊距與墨跡外框（CI 閘門）
npm run check:classes  # 找出不產生任何 CSS 的類別（CI 閘門）
npm run check:llms     # llms.txt 有沒有漏掉已發布的頁面（CI 閘門）
npm run check:md       # 100 份 Markdown 雙生檔（CI 閘門）
npm run check:dates    # 日期已宣告且自洽（CI 閘門）
npm run check:jsonld   # 結構化資料有效且無重複鍵（CI 閘門）
npm run check:design   # 模板是否牴觸 DESIGN.md（CI 閘門；四條結構規則讀 dist/，要先 build:site）
npm run check:routes   # 已發布路徑與 ledger 相符（CI 閘門）
npm run routes:record  # 新增路由後把它寫進 ledgers/published-paths.txt
npm run check:entity   # 建置產物的實體宣告與 @id 圖（CI 閘門）
npm run check:entity:links  # sameAs 的 URL 是否解析得到（CI 閘門，需網路）
npm run check:ko       # 韓文的空白與引號決定沒有改變（CI 閘門）
npm run ko:record      # 把今天的韓文決定寫進兩份 ledger
npm run check:i18n     # 英文模板有沒有中文標點（CI 閘門）
npm run test:worker    # src/worker.js 的語言協商與「不自組回應」（CI 閘門）
npm run check:locale-drift  # 這次改動是不是只動了某條路由的部分 locale（CI 只警告，不擋）
npm run dates          # 宣告的日期 vs git 認為的（僅報告）
npm run screenshot <label>   # 截圖到 .visual/<label>/
npm run diff <a> <b>         # 像素比對
npm run blank <label>        # 截圖的空白行比例與最長連續空白（給人看，不是閘門）
npm run md:audit             # Markdown 雙生檔與 HTML 的逐段對讀（給人看，不是閘門）
```

**`geometry`、`contrast`、`contract`、`cards` 要先 `npm run serve`**，它們對 `http://127.0.0.1:8099`（或 `BASE_URL`）發請求。同時開多個 worktree 時，每個用自己的 port 起 `npx wrangler dev --port <n>`，再以 `BASE_URL` 指過去。

`.github/workflows/checks.yml` 在 PR 與推送 main 時跑兩個 job。**`build`**：`cargo fmt` / `cargo clippy` / `cargo test` / `build:site` / `check:css` / `check:classes` / `check:llms` / `check:md` / `check:dates` / `check:jsonld` / `check:design` / `check:routes` / `check:entity` / `check:ko` / `check:i18n` / `test:worker`。**`audit`**：安裝 chromium、建置、用 `npm run serve` 供應，然後 `contrast` / `contract` / `geometry` / `cards` / `check:entity:links`。Chromium 以 `package-lock.json` 為 key 快取（`zone.yml` 也是），命中時只裝系統相依。

**runner 釘在 `ubuntu-24.04`，不用 `ubuntu-latest`**（兩個 workflow 都是）。`ubuntu-latest` 自 2026-10-19 起改指 Ubuntu 26，而 `playwright install --with-deps` 是依發行版解析系統套件的——它還不認得的新版會讓 audit（必要檢查）在每個 PR 上同時失敗。要換版本時，先在一個 PR 上把 `runs-on` 改成新 image 跑綠，再合併。actions 用 `checkout@v7`、`setup-node@v7`、`cache@v6`（Node 24 runtime）。

兩個 job 刻意平行而不共用產物：audit 約 10 分鐘（geometry 佔大半）、build 約 1 分鐘，讓 audit 等 build 的 `dist/` 會拉長總時間。

**需要瀏覽器或網路的都在 `audit`，離線的都在 `build`。** 前兩者跑在 wrangler 供應的 `dist/` 上，因為只有 wrangler 會套用 `_headers`——用一般靜態伺服器驗，一條永遠匹配不到的標頭規則看起來完全正常。

**十四道**閘門的門檻都設在「乾淨」而非「不要更糟」，趁現在乾淨時設，才不需要維護一份豁免清單。

⚠️ **這個數字錯過兩次，而第二次是在這段警告自己裡面。** 第一次它寫「九道」而實際有十道——`check:routes` 落地時沒有進這份清單，於是有人（我）照著這裡數，在 PR 上公開宣告「九道閘門全綠」。**文件與 CI 分歧時，綠的是 CI，錯的是宣告。**

第二次：更正那次把總數改成十三，但緊接著寫「下面**十道**加上 `check:css`、`check:routes`、`geometry`」——**下面的清單早就含那三項了，一共就是十三**。所以那句加法把三項算了兩次，卻剛好因為總數是對的而讀起來成立。**寫在專門警告數錯閘門的段落裡，而且沒有人發現。** 教訓不是「要更小心」，是**別在文件裡放第二種數法**：清單是唯一的來源，總數是數它得到的，沒有需要相加的東西。**第三次**：清單漏了 `check:md`，總數也還停在十四。它是隨 Markdown 雙生檔（issue #259）加進 `checks.yml` 的，而這段文字沒有跟上——同一種漂移，第三次，寫在專門警告它的段落裡。**第四次**：`cards` 隨 v5 的規則 29 加進 `checks.yml`，而這段文字沒有跟上，總數還停在十五。**同一種漂移，第四次，寫在專門警告它的段落裡**——而且這一次是被兩軸審查抓到的，不是被任何閘門。**沒有東西數這個數字**，這就是它一直漂的原因。**第五次**：`test:worker` 隨稽核修正加進 `checks.yml`，這一次同一個 commit 就改了這裡。現在是**十七道**——下面的清單有幾項就是幾道。改 `checks.yml` 時請一併改這裡。

- **contrast** —— 0 隱形元素、0 不符 WCAG AA，**跑兩趟**：一般配色，以及 Windows 高對比（Playwright `forcedColors: 'active'`，量到的是作業系統換上的系統色）。第二趟抓的是本站 CSS 把前景與背景畫成同一個系統色的地方——任何使用者配色下都是 1:1。`--mode normal|forced` 只跑其中一趟；兩趟合計約 6 分鐘
- **contract** —— 每條路由的狀態碼、`lang`、canonical、分享圖、結構化資料、**所有引用資產（含 manifest 裡的圖示與 CSS 裡的字體）**、CSP 違規、JS 錯誤、`/` 的語言協商與 bot 豁免、**`asset versions`**（每個 `/static/css`、`/static/js` 引用都帶 16 位內容雜湊，immutable 快取的前提，見下）。⚠️ **後兩者不再限於 production。** 這一行先前寫「只在 `BASE_URL` 指向 production 時」，那在語言協商還是 zone Redirect Rule 的計畫裡是對的；改成 `src/worker.js` 之後它已經搬出 `AGAINST_ORIGIN` 分支，對 `wrangler dev` 每次都跑。仍然只在 production 驗得到的是**三件**：HSTS 與 www → apex（那兩條才是 zone 設定），以及純文字檔（`/llms.txt`、`/robots.txt`）的 `charset`。⚠️ 這一行第二次寫錯，形狀和第一次不同：`charset` **是**這個 repo 裡的規則，只是 `wrangler dev` 不管規則在不在都會自己補上，所以本機的斷言會在它從未檢查過的東西上顯示綠色。被模擬器藏起來，不是不存在
- **geometry** —— 八個寬度下的水平溢出、圓角、44px 觸控目標（含 chrome 裡的普通 `<a>`：語言切換器、章節 rail、footer、skip link——探針原本只量 `a.btn` 與表單控制項，12px 高的下拉連結因此一直是綠的），以及依 locale 而定的行長上限；v5.2 起再加一根 `first-paragraph`：每條路由在三種手機高度下，第一段正文的第一行必須在第一屏內（投影片頁具名豁免；上線前對舊建置跑是 303 組裡 240 紅）
- **cards** —— 100 張 OG 分享卡的外邊距（5–9% 版寬）、墨跡外框（45–80% 版面）與尺寸（1200×630）。**唯一一道讀產出物而不讀原始碼的設計閘門**：邊距從 `build-og.js` 的 `padding` 算得出來，墨跡外框算不出來——原始碼裡沒有任何東西說得出一個平衡斷行的三行標題會蓋掉多少版面（DESIGN.md 決策 #111）
- **check:css** —— 已提交的 `styles.min.css` 與目前的模板一致
- **check:routes** —— 已發布的路徑與 `ledgers/published-paths.txt` 這份 ledger 相符，退役的路徑仍在 `[[redirect]]` 裡
- **check:classes** —— 沒有任何類別產生不出 CSS。模板自己的 `<style>` 宣告的 class 不算未知，**include 進來的 partial 的 `<style>` 也算**。今天全站 0 個 `<style>`：claude-skills-guide 的投影片樣式原本住在 `_skills-guide-style.html`，已搬進 `src/input.css`（CSP 不再允許 inline 樣式，見「幾個必須知道的細節」）
- **check:md** —— 一百份 Markdown 雙生檔的 front matter、正文、標題存在與否、殘留標記、連結、程式碼區塊、由兩部分組成的標題（雙語兩半、章節編號徽章）有沒有分開、裝飾藥丸有沒有變成內文、用字母編號的標題有沒有從 A 開始且不跳號，以及 HTML 有沒有指向它們。連結必須是 `https://`、`mailto:` 或 `tel:+`（完整國際號碼，複製到哪裡都成立）。斷言與檢查的數量寫在 `check-md.js` 裡，也只寫在那裡——這份清單刻意不重複它，理由跟上面那段一樣。沒有人用瀏覽器逛 `.md`，所以這是唯一會看它們一眼的東西。⚠️ 最後三道是**有人讀了十五行**才加的：九道斷言與 1564 條 production 斷言全綠的時候，`dist/ja-JP/about.md` 的第 13 行有一個當成句子的裝飾藥丸（共六十個），第 15 行有一個兩半黏在一起的標題（`with AI AI を`，共一百六十個）。兩者都不隱蔽，只是沒有人看。第三道是那次審查補的：修法差一點寫成「丟掉英文那半」，那會讓二十份英文頁失去標題，而當時沒有任何斷言看得見。**字母編號那道是第四道這樣來的**：`agent-dev-workflow` 五個語系都把四個案例編成 B C D E，標題卻寫「四個完整劇本」，從頁面上線以來沒有人發現——HTML 也寫 B，所以它不是轉換缺陷，稽核工具比對兩邊的那一趟從頭到尾都是綠的
- **check:llms** —— 每一個已發布的頁面都在 llms.txt 裡
- **check:dates** —— 每頁都宣告日期，沒有未來日期，發布日不晚於修改日
- **check:jsonld** —— 結構化資料有效，且沒有重複鍵（`JSON.parse` 看不到重複鍵，它會靜靜取最後一個）。取區塊用 `scripts/lib/html.js` 的 `jsonLdBlocks()`，check:entity 與 i18n-extract 也用它：`<script>` 多一個屬性也認得，而頁面上 `ld+json` 標籤的數目與讀到的區塊數不符時直接丟錯——先前兩道閘門只認逐字的 `<script type="application/ld+json">`，多一個屬性就整段跳過還報綠
- **check:design** —— 模板不牴觸 `DESIGN.md`。讀作者寫下的意圖，不解析 CSS 產物。**但四條結構規則（section cover screens、tags nest、anchor integrity、heading structure）讀建置後的頁面**（`scripts/design/rendered.js`）：原始碼分析看不穿 macro、`import`、`extends`，評估模板大改時實測過三種全綠的破壞。所以 **`check:design` 要在 `build:site` 之後跑**，`dist/` 比模板或 site.toml 舊時它直接拒絕。回報先用文字比對指回原始模板，找不到唯一位置才指向 `dist/` 的行號。規則 36 `tags nest` 另外保留讀原始碼的那一趟（`compose()` 展開 `{% include %}`，找不到的 partial 或超過 16 層會丟錯），因為它能指出交錯的兩個標籤各在哪個檔；原始碼乾淨而建置產物交錯時，另外以 dist 行號回報。規則 37 `no parameterised markup` 禁止 macro 把參數放進 `class`／`href`——那是讀屬性的規則看不到的地方。
  結構：`scripts/check-design.js` 只留 `RULES` 陣列與 `main()`；每條規則一個檔在 `scripts/design/rules/`，共用的解析與工具在 `scripts/design/lib.js`（`parseElements` 以 HTML 字串為 key 快取），讀建置產物的共用部分在 `scripts/design/rendered.js`。新增規則：在 `rules/` 加檔、在 `RULES` 加一筆；規則拿到 `(files, { rendered })`，要讀組合後的頁面就呼叫 `rendered()`
- **check:entity** —— 讀**建置產物**的實體宣告，八條規則：每個 `@id` 引用都有節點、全站只有一個 Organization 身分、title 與 description 用**該 locale 的書寫系統**（決策 #56 之前是「含中文」，那在五個 locale 之後不成立）、圖裡的 taux.io URL 指向本頁的 locale、`inLanguage` 說實話（決策 #61）、**FAQPage 的每一題與答案逐字出現在頁面上**（Google 要求 FAQ 標記的內容可見；稽核時 5 條路由 × 5 locale 標了看不到的 FAQ，現在頁面上有 `#faq` 章節）、**麵包屑從本 locale 首頁走到本頁的 canonical，且每一項都是已宣告的頁面；本頁自己宣告的節點（`@id`、`url`、`mainEntityOfPage`）指向本頁 canonical**（加這條之前 75 個麵包屑有 38 個起點是會 302 的 `https://taux.io`）、**JSON-LD 裡沒有 HTML 實體**（autoescape 會把模板裡的 `{{ … }}` 網址變成 `https:&#x2f;&#x2f;…`，而那仍是合法 JSON）。它讀 `dist/` 而不是 `templates/`，因為 `@id` 圖只有在 include 組合完成後才成形
- **check:ko** —— 韓文的**兩類**排印決定沒有改變：`ledgers/ko-spacing.txt` 記 777 處詞間空白（跨行內標籤的邊界），`ledgers/ko-quotes.txt` 記 319 處引號連同它用的是哪一對。**它是 ledger 不是規則**，兩類都是：助詞黏著、實詞分開，而同一個音節是哪一種要看語意（`</strong>가` 是助詞，`</strong>가능한` 是實詞）；引號同理，直接引述用 `""`、術語與強調用 `''`、法規與條目名用 `「」`、獨立發布的文件名用 `『』`，而分辨「這句是話還是術語」沒有任何字元規則做得到。所以它記住人做過的每一個決定，只在改變或出現新頁時說話。⚠️ **它不知道那些決定對不對，只知道有人做過**。⚠️ **它原本叫 `check:ko-spacing`**，issue #240 把引號加進來之後那個名字就只對一半——這份文件開頭數的那幾次錯，全部都是描述停在它描述的東西之前。名字裡拿掉 `spacing` 是為了下一類進來時不必再改一次
- **check:i18n** —— **建置後的**英文頁（20 份 HTML 與 20 份 Markdown 雙生檔，清單取自路由表——英文首頁是 `dist/en-US.html`，不在 `dist/en-US/` 裡）沒有中文標點（`scripts/i18n-extract.js gate`）。⚠️ **只判標點，不判漢字**：登記名稱 `拓思科技股份有限公司` 是專有名詞，要留著；漢字在英文頁上是判斷題，而**會對判斷題報紅的閘門遲早會被關掉**——同一支腳本的 `check` 模式刻意不回非零就是這個理由。
  它原本讀 `templates/en-US/`，理由是每一頁建出來都帶著全站 Organization 節點中文 `description` 的六個標點；issue #241 把那句改成 per-locale 之後理由就不成立了，而這道閘門多留在模板上一段時間。讀 `dist/` 會多守住模板守不住的事：共用 partial、site.toml 字串或 JSON-LD 把中文標點帶上英文頁——**那正是 #241 的形狀**
- **test:worker** —— `src/worker.js` 的 `Accept-Language` 協商（q 權重、簡繁、`q=0`），以及 Worker 產生的每一個 `Response` 都是轉包資產層的回應——自己組的回應不會套用 `_headers`，等於沒有 CSP
- **check:entity:links** —— `sameAs` 的 URL 解析得到。只抓硬性 404；登入牆後面的軟性 404（Facebook 對不存在的頁面回 200）抓不到，那仍然是人的判斷

**`check:locale-drift` 不是閘門，所以不在上面的數目裡。** PR 改了某條路由的部分 locale（模板，或 site.toml 的 title／description）而其他 locale 沒動時，它在 CI 印出 GitHub warning 與 job summary 的表格，永遠回 0——只改一個 locale 常常是對的（錯字、韓文空白）。它存在是因為 #300 修了 about 的語氣，ja／ko／en 卻留著舊文案三週，每道閘門都綠：閘門比對的是標記，漂的是文字。第一次對歷史跑就抓到 ai-smart-work 與 data-governance 的 ja／ko 仍是舊文案。**它看不到**「每個 locale 的檔案都動了、但只有部分改完」——那正是 #300 的 about，檔案層級的 diff 會把它當成完整的改動。CI 的 build job 因此以 `fetch-depth: 0` checkout。

**`check:entity` 會拒絕稽核不完整的 `dist/`。** 建置是一頁一頁寫的，遇到第一個解析不了的模板就結束，所以失敗的建置會留下半棵樹——而所有讀 `dist/` 的檢查都會對著它報綠。這實際發生過：一個壞掉的 include 讓十七頁只寫了八頁，三條規則全部「通過」。它現在會比對 `site.toml` 宣告的頁數。

截圖與像素比對刻意不設為閘門：跨機器的字體渲染差異會產生假警報，它們是給人看的工具。

### 寫捲動斷言時，`scroll-smooth` 會讓探針說謊

`<html>` 掛著 `scroll-smooth`，所以 `window.scrollTo(...)` 是動畫的。**在動畫開始之前讀位置，拿到的是捲動前的值**，而那個值看起來完全像是一個合理的失敗。

同一個陷阱在一次工作裡踩了兩次：先讓人以為 `position: sticky` 失效，再讓人以為錨點連結在無 JS 時跳不動。兩次都是探針錯，不是頁面錯。

任何捲動斷言必須擇一：用 `behavior: "instant"`，或等動畫跑完。而**在下結論說某個東西壞掉之前，先確認量測本身是對的**——一個符合預期的失敗最不容易被追究。

### `styles.min.css` 是進版控的建置產物

Tailwind 掃描模板產生它，所以**改完模板沒重建就會靜默失效**——曾經發生過，`.md:h-20` 沒進去，七個頁面的曲線細帶少了 16px 而毫無跡象。`npm run check:css` 就是為此存在。

### `?v=` 版號由內容算出，所以 CSS/JS 可以 immutable

`styles.min.css` 與 `static/js/*` 的 `?v=` 是檔案內容的 FNV-1a 雜湊，由 generator 的 `content_version()` 算出並傳給模板（`css_version`、`js_version["<檔名>"]`）。檔案一變，網址就變，所以 `_headers` 把 `/static/css/*` 與 `/static/js/*` 設成 `max-age=31536000, immutable`。

先前這裡寫的是「版號是手動的，所以只給一小時」——那在手寫 `?v=25` 一年沒動過的時候是對的決定。**immutable 只在每個引用都帶雜湊時安全**，`contract` 的 `asset versions` 斷言守這件事：任何 `/static/css`、`/static/js` 引用沒有 16 位十六進位的 `?v=` 就紅。新增一支 JS 時照 `section-index.js` 的寫法引用即可，不用記任何數字。

---

## 怎麼把一批工作切開與落地

一份 spec 一支分支一個 PR。票是**落地順序**，不是各自的 PR——這個 repo 合併就是上線，PR 越少、驗證的次數就越集中。

**只在有決策點的地方切票。** 判準是：這張票結束時，有沒有人要看著結果做一個決定？沒有就別切。曾經把「十條風險內容」拆成上下五條，實作時被併回同一個 commit——五要素的形狀在第一條就定死，後九條是照抄，中間沒有任何值得停下來的地方。

**前置重構獨立一張，排最前面。** 一條新的檢查規則若先落地，後面寫的東西就天生受它保護；合進使用它的那張票，它就從「讓錯誤不可能發生」退化成「事後稽核」。

**新檢查器帶著關閉狀態落地，由讓它成立的那張票開啟**，並在程式碼裡具名寫出票號。這樣 CI 一路綠燈而不需要豁免清單——用關掉規則換綠燈和用豁免清單換綠燈是同一件事，差別只在前者誠實。`check:design` 與 `check:entity` 都是這樣落地的。

**骨架票要含一個決定，否則只是延後。** 「頁面先存在、內容之後補」本身沒有價值；有價值的是在那張票裡把**後續工作依賴的東西定死**——例如章節 id。定死了，做索引的人就不必等內容寫完。

### 重構用「產物逐位元組相同」驗收

只改結構、不該改輸出的工作（抽 partial、推導 site.toml 欄位、拆 generator 或 check-design），驗收條件寫成：**改動前建一份 `dist/`，改動後 `diff -r` 無差異**。它比任何檢查表都完整——HTML、Markdown 雙生檔、sitemap、`_redirects` 全在裡面。一個多出來的空行（HTML 註解被剝掉後留下的換行）就會讓它紅，那正是要的靈敏度。

閘門本身的重構換成**突變測試**：刻意製造違規，比對新舊實作的 stdout、stderr 與 exit code。check-design 拆檔時用了 28 種破壞，涵蓋當時全部 34 條規則。只在乾淨的樹上看到「全綠」證明不了什麼——一條被拆壞的規則在乾淨的樹上也是綠的。

### 疊起來的 PR：一次一個進 main，下一個 rebase 上去

一批改動拆成多個 PR 時，每個分支疊在前一個上面，前一個合併後用 `git rebase --onto origin/main <舊的前一個 commit> <分支>` 把下一個移上去再開 PR。squash merge 之後舊 commit 不在 main 的歷史裡，所以一定要用 `--onto` 指明起點，不能直接 `git rebase origin/main`。

平行開發用 `git worktree`，每個 worktree 自己的 `dist/`、自己的 wrangler port（見「建置與檢查」）。在 worktree 裡把 `node_modules` symlink 到主 checkout 可以省下安裝，但**別讓它被 commit**：`.gitignore` 的 `node_modules` 刻意不帶斜線，因為帶斜線只匹配目錄、不匹配 symlink，這次就被 commit 了兩次。

### 兩份 spec 同時進行時，多開一張整合票

各自全綠不代表合併後成立。曾經有兩支分支分別通過全部閘門，合併後建置直接失敗：一支新增的頁面引用了另一支刪掉的 partial。git 兩邊都乾淨合上，因為一邊是新檔案、一邊是乾淨的刪除。

**沒有任何一張票會抓到這種問題**，因為每張票的驗收條件都只看自己那支分支。所以只要同時有兩份 spec 在跑，就開一張整合票，驗收條件寫死：**在合併結果上**跑完全套閘門。合併前先做一次試合併，不要等到合併時才發現。

這是範圍問題不是粒度問題——調票的大小補不起來。

### 有時效的前提要用機制擋，不能只寫字

曾經有一張票要求「必須在任何改動上線之前完成」，理由充分且不可逆（它是一次量測的對照組）。那個限制寫進了票的 Blocked by，也寫進了 PR 說明，然後被一句口頭指示蓋過去，對照組永久消失。

**它從頭到尾只是散文，沒有任何東西會擋。** 真的不能先合併的東西，要用 draft PR、required review、或乾脆不推分支。把不可逆的前提交給文字去守，它就守不住。

---

## 部署

**靜態網站，由 Cloudflare Workers 以靜態資產（static assets）從邊緣節點供應。** 沒有執行期伺服器。`wrangler.jsonc` 的 `main` 是 `src/worker.js`，但 `run_worker_first` 只有 `["/"]`：只有根路徑會進 Worker，其餘全部直接走 assets 層（見下面「`/` 的語言協商」）。

**合併就是上線，而上線會落後 CI。** Workers Builds 在 `main` 收到推送後自己 clone、建置、`wrangler deploy`；它的建置會排隊，曾經一筆停在 `in_progress` 二十多分鐘才完成。確認某次合併是否已上線，看那個 commit 的 check run「Workers Builds: taux-io」是否 `completed`，或直接 `curl` 一個這次改動才有的值——不要只看 PR 的綠燈。

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

### `/` 的語言協商，以及它為什麼從 zone 搬回 repo

`/` 依 `Accept-Language` 送人去對應的 locale。**做在 `src/worker.js`，不在 zone 的 Redirect Rules 上。**

原本的計畫是 zone 規則，改掉的理由有兩個，第二個才是決定性的：

**一、那個欄位讀不到。** `http.request.accepted_languages` 是 Cloudflare 幫你解析並依 `q=` 權重排好序的陣列，正是這件事要的東西——但它的文件寫明「only available in Transform Rules」。Redirect Rules 只看得到生的 `http.request.headers["accept-language"]`，能做的只有比對前綴。那對一般瀏覽器夠用（瀏覽器本來就依偏好排序送），但 `zh-TW;q=0.1, en;q=0.9` 會答錯——前綴說中文，權重說英文，而使用者要的是英文。

**二、zone 規則驗不到。** 它活在後台，review 看不見，而且只有 `BASE_URL` 指向 production 時契約測試才驗得到——也就是**上線之後才知道對不對**。本檔在 HSTS 那節已經記過這個代價，能少一個就少一個。

Worker 版本兩個問題都沒有：規則進版本控制，`contract` 對 `wrangler dev` 就能跑，而且 `q=` 權重解得出來。

**它不自己組回應，而那是整個設計的重點。** `wrangler.jsonc` 開頭那段警告仍然成立：`_headers` 套用在靜態資產上，套不到 Worker 產生的回應。所以 `src/worker.js` 向 assets 層要一個回應——一般請求要的是它本來就會送出的那個，bot 要的是 `/zh-Hant-TW` 那個——然後只改標頭。`_headers` 裡的東西全部照樣到齊，因為是 assets 層放上去的。

**現在是機制，不只是紀律。** `npm run test:worker`（`scripts/worker.test.mjs`，進 CI）會在 Worker 出現任何不是 `new Response(x.body, x)` 形狀的 `new Response(…)` 時失敗——自己組的回應拿不到 `_headers`，等於沒有 CSP。同一支測試也釘住 q 權重、簡繁與 `q=0` 的協商結果。這一段先前寫的是「沒有任何東西檢查」（決策 #63 記錄的就是那個缺口），現在補上了。

`run_worker_first` 設成 `["/"]`：**只有這一條路徑會進 Worker**，其餘全部照舊直接走 assets，所以上面那個風險的爆炸半徑正好是一條路徑。沒設這行的話 Worker 根本看不到 `/`——`_redirects` 屬於 assets 層，它先匹配，請求在任何程式碼跑之前就被回答掉了。

**有 User-Agent 判斷，那就是 bot 豁免。** 決策 #59 與 issue #200 的驗收條件是同一件事：Googlebot 一類的爬蟲送到 `/` 要拿到 **200 而不是導向**，而且**位元組與 `zh-Hant-TW` 版相同**。做法是 `src/worker.js` 比對一份具名的爬蟲清單（Googlebot、bingbot、DuckDuckBot、Baiduspider、YandexBot、Slurp、Applebot、GPTBot、ClaudeBot、PerplexityBot），命中就向 assets 層要 `/zh-Hant-TW` 的回應原封送回。**依 User-Agent 給不同內容是 cloaking；依 User-Agent 決定跳不跳不是**——這條分界是 #59 的原文。清單漏一個的代價有界：那個爬蟲拿到跟一般讀者一樣的 302，目的地帶著自我指向的 canonical 與完整 hreflang。

⚠️ **這一段先前寫的是相反的話**：「沒有 User-Agent 判斷，這是刻意的」，論點是不送 `Accept-Language` 的爬蟲自然落到正典 locale，所以已經達成 #59 要的結果。**沒有達成**——爬蟲拿到的仍然是 302，而驗收條件寫的是 200。同一段改寫同時出現在 `src/worker.js` 的檔頭與 `contract` 的註解（那裡甚至把 #59 寫成「依 UA 給 301／302 就是 cloaking」，與 #59 的原文相反），三個檔案互相印證，讀起來像這件事被想過了。**換掉條件不是滿足條件**，而三份一致的錯比一份醒目。

⚠️ **`Vary` 因此是 `Accept-Language, User-Agent`**，兩個分支都送。回應現在同時取決於這兩個標頭，而共享快取存的是「這個 URL 回了什麼」而不是「走了哪個分支」——302 若不帶 `User-Agent` 存下去，下一個爬蟲就會被餵那份 302，豁免在唯一看不到的地方失效。

⚠️ **`/` 曾經是 301，而且已經快取在訪客的瀏覽器裡。** `site.toml` 的註解寫著要用 302，但那筆 `[[redirect]]` 沒寫 `status`，於是吃了 301 的預設值。**註解是設計，資料是上線的東西。** 已改成 302，但改不掉別人瀏覽器裡存著的那一份——那些人不會再問，直接去 `/zh-Hant-TW`。

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

### 縮小部署機器上的安裝範圍，量過之後不做

Workers Builds 在跑建置指令之前會自己跑一次 `npm clean-install`，裝完整個
`package.json`——包含 playwright 那一整棵樹——**而且是在持有部署憑證的那台機器
上**。稽核把它列為硬化項目，理由是「第三方套件被入侵時，程式碼會在憑證旁邊
執行」。

**量完之後這條建議撤回，理由不是不重要，是做了沒用。**

把建置真正需要的（tailwindcss、postcss、autoprefixer、wrangler）搬進
`dependencies`、其餘留在 `devDependencies`，再用 `--omit=dev`：

| | |
|---|---|
| 省下的套件 | **4 個**（176 → 172） |
| 有安裝腳本的套件（全部） | esbuild、fsevents、workerd、wrangler/node_modules/fsevents |
| 有安裝腳本的套件（`--omit=dev` 後） | **完全一樣** |

**那四個會執行安裝腳本的套件全部來自 `wrangler`**，而部署非它不可
（`npx wrangler deploy`）。playwright 有四十幾個套件，**一個安裝腳本都沒有**。

所以縮小安裝範圍**完全沒有減少憑證旁邊的程式碼執行面**——它只是少下載一些不
執行任何東西的檔案。原本那條建議是從「套件多 = 風險大」的直覺來的，而那個直覺
在這個相依樹上不成立。

⚠️ 真正剩下的殘餘風險是同一條建置指令開頭的 `curl --proto '=https' --tlsv1.2
-sSf https://sh.rustup.rs | sh`（見上）。那個也移不掉：建置映像沒有 cargo。
rustup 沒有提供穩定的 checksum 流程，所以能做的只有知道它在那裡。

### fork 的 pull request 會不會觸發 Cloudflare 建置

**維持「Builds for non-production branches」開啟**（Settings → Build →
Branch control）。

這個問題來自稽核：如果 fork PR 會觸發建置，外部貢獻者就拿到了部署憑證旁邊的
程式碼執行。兩家的文件都沒有明說 fork 的情況——Cloudflare 說建置由 `push` 事件
觸發，GitHub 說 `push` 只對**分支**發送，而 `refs/pull/N/head` 不是分支。推理
上不會，但沒有白紙黑字。

關掉它可以讓這個問題在任何解讀下都不成立，代價是拿掉一個真實訊號：非
production 建置是**唯一一個在真正的部署環境裡驗證建置**的東西——用那條
`curl | sh` 的指令、在 Cloudflare 自己的機器上。GitHub Actions 跑的是另一台
機器、另一套安裝路徑，而這份文件上面已經記過「CI 驗的產物和 Cloudflare 部署的
產物是同一個 commit 的兩份不同建置，從來沒有比對過」。

維持開啟的三個理由：390 個 commit、124 個 PR **全部來自 `taux-io` 自己的分支，
零個 fork**；非 production 建置跑的是 `wrangler versions upload`，不導流量、不
碰 production；而 `main` 現在有分支保護，要進 production 得先過 CI。

想要確定性而不關掉任何東西的話：看 Settings → Build 的建置歷史，確認每一筆的
來源分支。

### 幾個必須知道的細節

- **輸出是扁平的 `.html`，不是目錄。** `geo-guide.html` 在 `/geo-guide` 直接供應；若寫成 `geo-guide/index.html`，主機會把 `/geo-guide` **308 重導**到 `/geo-guide/`——每條已索引的 URL 多一跳，而 canonical 指向主機不直接服務的形式。
- **CSS／JS 快取一年、immutable；分享卡、brand、圖示七天。** 前者安全是因為 `?v=` 是內容雜湊（見「建置與檢查」）。`script-src` 只有 `'self'` 與 Cloudflare 的 beacon 來源——prompt injection 頁的圖表改成建置時產生的 SVG 之後，`cdn.jsdelivr.net` 已經拿掉，站上沒有任何第三方腳本。**`style-src` 只有 `'self'`**：`'unsafe-inline'` 是為了投影片頁的 `<style>` 區塊與 65 個 `style=""` 留著的，兩者搬進 `src/input.css` 之後拿掉（DESIGN.md 決策 #153）。`dist/` 裡 0 個 `<style>`、0 個 `style=`；JS 用 `element.style.x = …` 走 CSSOM，不受 CSP 管。新寫一個 inline 樣式會被瀏覽器擋下，`contract` 的 CSP 違規斷言會紅。
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
- **結構化資料 logo**：`static/brand/logo-on-light.png`，由 `brand-src/taux-logo-light.png` 裁切而來（來源檔不在 `static/`，所以不會被發佈）。**命名描述使用情境而非顏色**：原本的 `taux-logo-dark.png`（給深色底用的白色標記）曾被誤當成「深色的 logo」放進 JSON-LD，於是 Google 收到一張白底白字。
- **OG 分享卡**：每條路由一張，標題與 description 取自 `site.toml`，檔名由 canonical URL 推導——與 generator 算 `og_image` 用同一條規則，兩邊不可能分歧。輸出經 sharp **無損**重壓（zlib 9），100 張從 6.0 MB 降到 2.5 MB；刻意不用調色盤量化，因為 `cards` 量的是墨跡，量化會移動它。`build:og` 每次重寫全部 100 張，而 Chromium 的反鋸齒在不同次執行間會有微小差異——**只 commit 標題或 description 真的變了的那幾張**，其餘 `git checkout` 回去。
- **簡體版起稿**：`node scripts/hans.js`（或模組的 `toHans()`）。詞彙表 `scripts/hans-terms.js` 是唯一的決定點。⚠️ 2026-09 修掉一個替換順序的 bug：逐條替換會讓後面的規則改寫前面的輸出（资料夹 → 文件夹 → 文档夹），`/zh-Hans-CN/claude-skills-guide` 等 6 頁因此出現「文档夹」「文档名」；現在是一次比對全部詞條。那 55 行只改了「档 → 件」這一個字，其餘人工修訂保留
- **favicon.ico**：`build-icons.js` 寫進 `public/`（根目錄發佈），其餘圖示寫進 `static/`。

---

## 模板結構大改：A 的 cover 與 FAQ 已做

2026-09-26 評估三件事，**在 pqc-migration 上實際改寫、在改寫後的標記裡注入違規**量出來的，不是推測：

| | 省下多少 | 會讓哪些閘門失明 | 結論 |
|---|---|---|---|
| **A. Jinja macro**（cover、FAQ、CTA、hero） | cover 545 處／約 2,400 行，但有 14 種變形、巨集要約 6 個參數；FAQ 40 處；CTA 幾乎全是各頁文案；hero 沒有共用外殼 | `section-cover-screens` 跳過 `_*.html`、`tags-nest` 的 `compose()` 只展開 include——**巨集裡拿掉 `data-cover`、或留一個沒關的 `<div>`，check:design 與 check:md 全綠而且建置成功**。class／href 以參數傳入時，十多條讀屬性的規則與 check:classes 都看不到 | 前置條件滿足後只做 cover 與 FAQ |
| **B. `{% extends %}` base layout** | 幾乎不省（每頁本來就只有兩行 include）；唯一收益是 JSON-LD 進 `<head>` | base 檔要命名成 `_*.html` 才不被當成頁面，而那就讓它失明：**刪掉 `_base.html` 的 `</main>` 時 check:design 是綠的**（現況在 footer.html 刪同一行會報 100 個違規） | 要做就和 A 一起、在同一個前置條件之後 |
| **C. BreadcrumbList 由 site.toml 產生** | 75 塊麵包屑約 730 行、寫死的 locale URL 350 處 | check-design 不讀 JSON-LD，不受影響 | ✅ **已做（#323）**：site.toml 每個 locale 的 `crumb`，generator 以 serde_json 組出節點、當 safe string 交給模板的 `{{ breadcrumb }}`。改動前後 101 頁的 JSON-LD 逐頁 deep-equal、其餘位元組不變。Article 的 `@id`／`mainEntityOfPage` 仍手寫，由 check:entity 的 `page nodes name their canonical` 守著 |

**A 與 B 的前置條件已完成**：四條結構規則改讀建置產物（用文字比對指回原檔），並加了規則 37 禁止 macro 接收 `class`／`href` 參數。用評估時的破壞重測：macro 拿掉 `data-cover`、macro 留一個沒關的 `<div>`、macro 把 class 當參數，現在都紅；macro 產生的 id 被連結時不再誤報。

**A 已做，只做 cover 與 FAQ**（CTA 與 hero 不做，理由見上表）。macro 在 `templates/_blocks.html`，用到的頁面第一行 `{% from "_blocks.html" import … -%}`（`-%}` 吃掉 import 那一行留下的換行）：

- `cover(eyebrow=none, label=none, flush=false)`——章節封面。眉標兩種寫法由有沒有 `label` 決定（`01` 用 `font-sans` 的整段，`02 — Tool wrapper` 只有數字是 `font-sans`），`flush=true` 給 h2 加 `mb-0`（adk-skill-patterns）。h2 的內容是 `{% call %}` 的本體，所以雙語的 `display-lead`／`display-sub`、`block text-base` 的副標都留在頁面上、照舊被讀 class 的規則看到
- `slide_cover()`——claude-skills-guide 的投影片封面（`h2.slide-title`、沒有眉標）
- `faq(question, last=false)`——FAQ 一題；答案是 call 本體，`last=true` 是最後一題的 `border-b`

轉換前先量了變形：570 個 `<div class="cover" data-cover>` 分成 14 種外殼（眉標：數字、數字加英文名、無；h2：無 class、`mb-0`、`mb-0 relative z-10`、`slide-title`、`eyebrow` 帶 id），另有 7 處在眉標與 h2 之間夾著 HTML 註解（註解移到 call 上方，產生器本來就會剝掉）。**轉了 525 處（`cover` 470、`slide_cover` 55），手寫留下 45 處**：what-is-mcp 五個 locale 的 35 個（h2 本身是 `class="eyebrow"` 還帶 `id`，是單頁的版式）與 data-governance、geo-optimization 的 10 個（h2 是 `mb-0 relative z-10`；兩頁上都沒有絕對定位的東西要它疊過去，看起來是殘留，但拿掉會改變輸出，不在這次範圍）——各為一頁多開一個參數，就是評估時說的「6 個參數的巨集」。**這 45 個後來也收進 `cover()`（#330）**，是改版式而不是加參數：what-is-mcp 的 h2 從眉標字級改成跟其他長文頁一樣的「數字眉標＋一般 h2」，錨點 id 移到外層 `<section>`；data-governance、geo-optimization 拿掉沒有作用的 `relative z-10`，成為 `cover(flush=true)`。現在所有可見的封面都經過 macro。FAQ 125 題全轉（兩種變形只差 `border-b`）。`data-cover="sr"` 的 12 個只給螢幕閱讀器的 h2 不是這個外殼，沒動。模板少了約 2,500 行。

**驗收用「產物相同」**：改動前後的 `dist/` 320 個檔，245 個逐位元組相同（全部 100 份 Markdown 在內），75 個 HTML 只差空白——macro 的輸出不知道呼叫處的縮排，所以封面與 FAQ 內部的縮排變了，空白有無不變（連續空白收成一個之後逐字相同）。`styles.min.css` 不變。突變測試：macro 裡拿掉 `data-cover` → `section cover screens` 紅、指向 `_blocks.html` 的行；macro 的 div 加 `rounded-[7px]` → `radius scale` 紅。

**兩道讀原始碼的閘門跟著改了**，否則它們會被 macro 呼叫騙到：`check:classes` 原本把 `{% … %}` 裡所有字串當 class 候選（為了 `_nav-columns.html` 的 `with`），於是 `{% call faq("Why discount self-reported time savings?") %}` 的 `self-reported` 被報成不存在的 class——規則 37 保證 call 的參數不會進 class，所以 `call`／`from`／`import` 標籤跳過。`check:ko` 原本把 `{% … %}` 整段拿掉，那會讓 FAQ 問題裡的引號從 ledger 消失；現在保留 `{% call %}` 的字串參數。ko-quotes 有 4 行的左側上下文因此改寫（引號本身沒變），已重新 record。

**B 沒做**，仍待擁有者決定（見「已知待辦」）：幾乎不省行數。

**C 的四個前置條件都已完成**：JSON 由 Rust 序列化（不經模板插值，autoescape 碰不到）；check:entity 的兩條斷言；首層統一為 `https://taux.io/<locale>`；site.toml 的 `crumb`。

## 已知待辦

分四類，每一項只寫在這裡；細節在括號指的段落。

### 需要擁有者決定

- **模板結構大改的 B（base layout）。** A 的 cover 與 FAQ 已做，所有可見封面都經過 `cover()`；B 幾乎不省行數，建議不做，要做仍需擁有者決定（見「模板結構大改」）
- **法律頁與兩頁導言框的標題層級。** 目前用只給螢幕閱讀器的 h2（`data-cover="sr"`）補起 h1 → h3 的跳級；改成可見的 h2 就要各開一個封面區塊

### 有日期

- **2026-10-19 之後：Ubuntu 26。** CI runner 釘在 `ubuntu-24.04`；Ubuntu 26 image 穩定、Playwright 支援之後，在一個 PR 上把 `runs-on` 改掉跑綠再切換（見「建置與檢查」）

### 可以直接做的工程項目

- **翻譯漂移警示細到段落。** `check:locale-drift` 只比對檔案，「五個 locale 的檔都動了、但只改完一部分」看不到（#300 的 about）。可以改成比對同一條路由各 locale 改動的段落數；誤報率要實作後才知道
- **Article／TechArticle 的 JSON-LD 也改由產生器組出。** 麵包屑已經是（#323）；約 55 個 Article 節點的 `@id`、`mainEntityOfPage` 仍手寫，目前由 check:entity 的 `page nodes name their canonical` 守著，不急

### 已知、刻意維持

- 法律頁內文維持英文（決定見 ja-JP 版模板的註解）
- FAQ 的 `<summary>` 裡包 `<h3>`：部分讀屏會把 summary 當按鈕、吃掉標題語意，拿掉 h3 又失去標題導覽
- Windows 中文渲染品質低於 macOS（見 DESIGN.md 的「字體」一節）
- 「不得有促銷語言」沒有東西檢查，而且大概檢查不了（DESIGN.md 的語氣一章）；`check:locale-drift` 只能提醒「別的語系沒跟著改」
