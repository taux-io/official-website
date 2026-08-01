# TauX 設計規範

這份文件是**設計的唯一來源**。顏色、字體、字距、圓角、間距、元件與動態，全部在這裡決定；`NOTES.md` 不再描述設計，`src/input.css` 與 `tailwind.config.js` 的註解只解釋實作細節，不定義規則。

先前的版本把設計描述散在三個檔案裡，其中兩個已經和現況不符——`NOTES.md` 寫著「標題 weight 400」，而模板普遍掛 `font-bold`（utilities 層勝出，所以實際渲染早就是 Bold，那行宣告是假的）。**規則寫了沒有東西檢查，就等於沒有規則**，所以這份文件的每一條都盡量寫成 `npm run check:design` 檢查得到的形狀。

> **這份文件自己也犯過同一個毛病。** 初稿宣稱 `adk-skill-patterns.html` 有 20 個 hex 值，那是把 `&#123;` / `&#125;`（為了 minijinja 而轉義的大括號）誤讀成顏色。實際數字是 **0**，全站皆然。留著這條錯誤的代價不是筆誤而已：照字面寫出來的檢查器第一次執行就會送出 20 個假警報，而一支開場就誤報的檢查會教會所有人跳過它。目視得出來的數字也要用工具數過——這正是這份文件存在的理由。

---

## 這套語彙的來源

單色深色，取自 `www.spacex.com`。這不是「風格接近」而是**以實測值為準**：下面每一個標成「實測」的數字，都是在 2026-08-01 從 `www.spacex.com` 的計算樣式讀出來的，不是從截圖目測或憑印象寫的。

**裁決規則**：參考站的實際做法與本站既有規則衝突時，**參考站為準**，規則跟著改。唯一的例外是參考站沒有的情境——**繁體中文**與**長文閱讀頁**——那兩種情境照本站原有的理由處理，並在下面標成「本站推導」。

參考站關鍵實測值：

| 項目 | 實測值 |
|---|---|
| 墨色 | `#F0F0FA`，層級靠 alpha（1 / .9 / .8）表達，**沒有第二支灰** |
| 內文字體 | `D-DIN, Arial, Verdana, sans-serif` |
| 標題字體 | `D-DIN-Bold`，**全大寫** |
| Hero 標題 | 60px、`line-height 54px`（0.9）、`letter-spacing -1px` |
| 中階標題 | 48px、`letter-spacing +0.96px` |
| 導覽 | 13px、`letter-spacing 1.17px`、uppercase、alpha .9 |
| 按鈕標籤 | 12px、uppercase、`letter-spacing normal` |
| 按鈕幾何 | 高 48–50px、`padding 0 20px`、`1px solid rgba(240,240,250,.35)`、`border-radius 4px`、底 `rgba(0,0,0,.5)` |
| 按鈕過場 | `background-color .5s cubic-bezier(.19, 1, .22, 1)` |
| 圓角 | 互動控制項 4px、縮圖 8px、社群鈕 32px（正圓）——**不是全域 0，也不是全域 4px** |
| 等寬 | `Roboto Mono` 16px，用在倒數與日期 |
| 捲動揭示動畫 | **0 個**。折線下 17 個元素，`opacity < 1` 的有 0 個，無 transform，無 IntersectionObserver |
| 版面 | `.section` 高 902 / 941px（約一個視窗），單欄，文案壓左，內文欄寬約 370px |
| 媒材 | 4 支影片、5 張圖。滿版影像是這套語彙的骨幹 |

**本站不採用最後一項**，理由見「視覺元素」。

---

## 遷移狀態

這份文件描述的是**目標**，不是全部的現況。程式碼尚未依此遷移。

| 章節 | 狀態 | 票 |
|---|---|---|
| 檢查（零 hex、捲動揭示） | ✅ | #50 |
| Token（表面、墨色、髮絲線、圓角） | ✅ | #51 |
| 字體（等寬自架） | ✅ | #52 |
| 字級與字距刻度 | ✅ | #53 |
| 元件（按鈕、導覽、eyebrow、標籤、引言） | ✅ | #54 |
| 標題治理 | ✅ | #55 |
| 視覺元素（生成式圖形） | ✅ | #56 |
| 版面 — 行銷頁 | ✅ | #57 #58 #59 |
| 版面 — 長文頁 | ✅ | #60 #61 #62 #63 #64 |
| 版面 — 法務頁與 404 | ✅ | #65 |
| 檢查（圓角） | 🔲 | #66 |
| 衍生資產 | 🔲 | #67 |
| 動態（移除進場逐層淡入） | ✅ | #50 |

每完成一個章節就把該列改成 ✅，並在同一個 commit 裡更新。**不要讓這張表落後於程式碼**——一份過時的規範比沒有規範更糟，讀它的人沒有理由懷疑它。

---

## Token

全部定義在 `src/input.css` 的 `:root`。`tailwind.config.js` 只暴露語意名稱，不放值。**模板裡不得出現任何 hex 值**（`check:design` 檢查此項）。

### 表面

| 變數 | 值 | 用途 |
|---|---|---|
| `--surface-deep-rgb` | `0 0 0` | 全幅 hero 與滿版 section |
| `--surface-rgb` | `10 10 11` | 頁面基底 |
| `--surface-raised-rgb` | `15 15 17` | 需要層次的面板 |

基底比純黑亮一階，因為密集的中文筆劃壓在 `#000` 上會產生光暈溢散。

### 墨色

**一個墨色，層級靠 alpha 表達。** 這取代先前三支獨立的灰（`#ffffff` / `#c8c8cc` / `#8a8a91`）。

```css
--ink-rgb: 240 240 250;
```

| 語意名稱 | alpha | 黑底合成值 | 用途 |
|---|---|---|---|
| `text-ink` | 1.0 | `#F0F0FA` | 標題、強調、按鈕標籤、hover 態 |
| `text-ink-body` | 0.8 | ≈ `#C0C0C8` | **內文**、eyebrow、日期、註解 |
| `text-ink-muted` | 0.9 | ≈ `#D8D8E1` | 導覽靜止態、次級標題、靜止連結 |

注意 0.8 與 0.9 的用途看起來是反的——**不是筆誤**。參考站把 .9 用在導覽、把 .8 用在 meta；本站把內文放在 .8，因為 0.8 合成後約 `#C0C0C8`，與遷移前的 `#c8c8cc` 是同一個亮度階，中文長文的抗光暈保護不會因為換模型而消失。0.9 對拉丁導覽是安全的，對整段中文內文不是。

**`--text-muted` 這個角色消失了。** 以前用它做的層級（eyebrow、註解比內文更暗）現在改由**字級、大寫與字距**承擔，這是參考站實際使用的機制——它整站只有一個墨色，靠 type 建立層級，不靠明度。可見的後果是**註解與 eyebrow 會比以前亮**，這是預期的。

對比稽核不需要調整：`contrast.js` 本來就沿祖先鏈合成 alpha，而且所有值都變亮，WCAG 只會更寬鬆。

### 髮絲線

```css
--line-rgb: 240 240 250;   /* 與墨色同源 */
--line:        rgb(var(--line-rgb) / 0.08);   /* 分隔線 */
--line-strong: rgb(var(--line-rgb) / 0.35);   /* 控制項邊框 */
```

只有兩個權重：一條分隔線、一道控制項邊緣。`--line-strong` 從 0.2 提高到 **0.35**，這是參考站按鈕邊框的實測值。

更多權重就是髮絲線退回成裝飾的方式，不要加第三個。

### 圓角

```css
--radius: 0px;            /* 版面、區塊、圖片、分隔 */
--radius-control: 4px;    /* 互動控制項 */
```

**圓角只出現在摸得到的東西上**——按鈕、輸入框、下拉、開關。版面、區塊、卡片、影像維持方角。這就是參考站的做法（控制項 4px、縮圖 8px、社群鈕正圓），本站不採用縮圖那一階，因為沒有縮圖。

`tailwind.config.js` 的 `borderRadius` 把 `sm`/`md`/`lg`/`xl`/`2xl`/`3xl` 全部指向 `--radius`，`full` 保留給正圓（儀表、軌道、頭像）。**那些用不到的階不能刪**：刪掉之後一個後來寫的 `rounded-md` 會落回 Tailwind 自己的 `0.375rem`，方角規則就在沒有錯誤、diff 裡也看不出來的情況下破掉。

`check:design` 只允許 `rounded-*` 出現在互動控制項上。

---

## 字體

三支字體，各有明確的職務。

### D-DIN — 拉丁

自架，Latin-only。DIN 1451 的衍生體，德國工業標準用在路牌、機器銘板與儀表面板上的那一支。參考站用的就是它。

授權 SIL OFL 1.1，Copyright (C) 2017 Datto Inc，授權書隨檔案放在 `static/fonts/OFL-1.1.txt`。

`@font-face` 必須宣告 `unicode-range` 限定拉丁範圍。這不是最佳化細節，是**中文永不等待字體下載**的機制：範圍外的中文字瀏覽器根本不會把它綁在這次下載上，所以長文的中文從蘋方／微軟正黑立刻上畫。

### 系統中文字 — 蘋方 / 微軟正黑 / Noto Sans TC

**中文走系統字體是決定，不是省事。** 繁體中文網頁字體即使做 unicode-range 切片仍有數百 KB，且 swap 時整頁重排；長文頁的搜尋與 GEO 表現正是它們存在的理由，不值得拿去換字體一致性。

**Windows 的中文會比 Mac 差一階，這是已知且接受的代價。**

### Roboto Mono — 等寬

自架，Latin-only，`unicode-range` 策略比照 D-DIN——但**取自這支子集檔案自己的涵蓋範圍，不是複製 D-DIN 的那一串**。宣告一個檔案沒有的範圍，等於讓瀏覽器去跟一支畫不出那個字的字體要字。

授權是 **SIL OFL 1.1，不是 Apache 2.0**。這份文件原本寫 Apache，那是這支字體多年前的授權；Google 已把 Roboto 家族改採 OFL，上游檔案在 `ofl/robotomono` 底下，`METADATA.pb` 宣告 `license: "OFL"`。**替一支 OFL 字體附上 Apache 通知不是筆誤，是授權聲明錯誤**，所以授權書隨檔案放在 `static/fonts/OFL-1.1-RobotoMono.txt`，與 D-DIN 那份分開——兩支字體同一個授權但不同的著作權人，OFL 要求各自的著作權聲明都要隨附。

等寬在這套語彙裡是**第二個聲音**，不只是程式碼字體。用途：

- `<code>` / `<pre>` 區塊
- 日期與時間
- 章節編號（`01`、`02`）
- 數值、百分比、量測值
- meta 標籤

在此之前這些交給系統堆疊（Mac 是 SF Mono、Windows 是 Consolas、Linux 又是別的），同一頁在三台機器上是三種等寬——那樣它不可能算是設計的一部分，因為不知道讀者看到什麼。

### 字體堆疊

```js
sans:    ["D-DIN", "PingFang TC", "Microsoft JhengHei", "Noto Sans TC", "system-ui", "sans-serif"]
display: ["D-DIN Condensed", "D-DIN", "PingFang TC", "Microsoft JhengHei", "Noto Sans TC", "sans-serif"]
mono:    ["Roboto Mono", "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"]
```

`<head>` 預載 `D-DIN.woff2`、`D-DINCondensed.woff2` 與 `RobotoMono.woff2`——它們決定首次繪製。Bold 面隨用隨載。

---

## 字級與字距刻度

參考站的字距**隨字級變號**：小型大寫是正的，大型標題是負的，按鈕是零。這是一條刻度，不是幾個各自決定的值。

| Token | 字級 | 行高 | 字距 | 字重 | 大小寫 | 來源 |
|---|---|---|---|---|---|---|
| `text-eyebrow` | 12px | 1 | `0.09em` | 400 | uppercase | 實測 10px/`1px`、13px/`1.17px` |
| `text-nav` | 13px | 1 | `0.09em` | 400 | uppercase | 實測 `1.17px` |
| `text-button` | 12px | 1 | `0` | 400 | uppercase | 實測 `normal` |
| `text-base` | 16px | 1.6 | `0` | 400 | none | 實測 16px |
| `text-display-sm` | 32px | 1.0 | `0` | 700 | uppercase | 本站推導 |
| `text-display-md` | 48px | 1.0 | `+0.02em` | 700 | uppercase | 實測 `+0.96px` |
| `text-display-lg` | 60px | 0.9 | `-0.017em` | 700 | uppercase | 實測 60px / `54px` / `-1px` |

**小型大寫一律 `0.09em`。** 遷移前是 `0.2em`（導覽、按鈕）與 `0.25em`（eyebrow），大約是參考站的兩倍。

**`line-height 0.9` 只能套在拉丁行。** 中文字身是滿框的，沒有 descender 的空隙可以吃，0.9 會裁到筆劃。中文行的行高見下一節。

**顯示級標題一律 Bold + 全大寫。** `input.css` 的 base 層目前把 `h1`–`h6` 設成 weight 400，那與模板普遍掛的 `font-bold` 相衝（utilities 層勝出，所以實際上早就是 Bold）。base 層改成與規則一致，這個既有的不一致一併消掉。

---

## 標題治理

參考站的識別度幾乎全押在 headline 上：D-DIN Bold、全大寫、行高小於字級、手動斷行、左對齊。**中文沒有大寫**，所以這個簽名在中文站只能由拉丁行承載。

### 規則

**H1 與各頁 section 首題採「英文領銜、中文降為副標」。**

```html
<h1>
  <span class="display-lead">Make the machine understand</span>
  <span class="display-sub">從新手到高手的指令秘籍</span>
</h1>
```

| 行 | 樣式 |
|---|---|
| `.display-lead` | `font-display`、Bold、**uppercase**、字級與字距取自刻度、行高 0.9（`display-lg`）或 1.0（`display-md`） |
| `.display-sub` | `font-sans`、weight 400、**不大寫**、字級為領銜行的 0.45–0.55 倍、**行高 1.15**、`text-ink-muted` |

中文副標**必須**有自己的 `line-height`。這是整份規範裡最容易被「順手統一一下」破壞的一條。

### 範圍

- ✅ 套用：全部 14 條路由的 **H1**，以及各頁**層級最高的 section 標題**
- ❌ 不套用：長文頁內部的 H2 / H3。那些維持中文——它們是實際被搜尋與被 AI 引用的內容

`site.toml` 的 `<title>` 已經多數是英文，所以 H1 改英文不會與 `<title>` 或 `og:title` 打架。

### 領銜句草稿

**以下是草稿，不是定案。** 這是新寫的文案而非翻譯，語氣應該由你決定；實作時請逐條改過再用。

| 路由 | 領銜（拉丁，全大寫） | 副標（中文） |
|---|---|---|
| `/` | CODE THE FUTURE | 用科技定義未來 |
| `/about` | BUILT IN KAOHSIUNG | 用科技創造未來 |
| `/ai-smart-work` | FROM GENERATING TO DECIDING | 95% 的人用 AI 生成內容，5% 的人用 AI 輔助決策 |
| `/data-governance` | GOVERN THE DATA FIRST | 數據治理指南 |
| `/building` | BUILDING IN PUBLIC | 公開建造中 |
| `/geo-guide` | GENERATIVE ENGINE OPTIMIZATION | GEO 入門指南 |
| `/workspace-ai-roi` | MANUAL VERSUS AUTOMATED | 手動 vs 自動：效率革命 |
| `/what-is-llms-txt` | WHAT IS LLMS.TXT | AI 時代網站內容保護新規範 |
| `/what-is-prompt-injection` | WHAT IS PROMPT INJECTION | AI 時代的資安危機 |
| `/agent-prompting-guide` | MAKE THE MACHINE UNDERSTAND | 從新手到高手的指令秘籍 |
| `/claude-skills-guide` | CLAUDE SKILLS IN PRACTICE | Claude Skills 實戰指南 |
| `/adk-skill-patterns` | FIVE SKILL PATTERNS | 每個 ADK 開發者都該知道的事 |
| `/privacy-policy` | PRIVACY POLICY | 隱私權政策 |
| `/terms-of-service` | TERMS OF SERVICE | 服務條款 |

各頁的 section 首題在實作各該頁時擬定，同樣先出草稿。

---

## 元件

### 按鈕

**完全對齊參考站的實測值。**

```css
.btn {
  height: 48px;
  padding: 0 20px;
  border: 1px solid rgb(var(--line-rgb) / 0.35);
  border-radius: var(--radius-control);
  background-color: rgb(0 0 0 / 0.5);
  color: rgb(var(--ink-rgb));
  font-family: theme(fontFamily.display);
  font-size: 12px;
  letter-spacing: 0;          /* normal — 不是 0.2em */
  text-transform: uppercase;
  transition: background-color .5s cubic-bezier(.19, 1, .22, 1);
}

.btn:hover { background-color: rgb(var(--ink-rgb) / 0.12); }
```

- 標籤後接 **→** 箭頭（`→`，不是圖示字體，不是 SVG）。實作為 `::after` 虛擬元素，所以新加的按鈕不可能漏掉它；這一併換掉了兩處各自手刻的 SVG 箭頭
- hover 是**換底色**，不是整顆反白
- 過場 500ms、expo-out。這比遷移前的 200ms 慢一倍以上，是刻意的——參考站的質感來自緩慢浮現
- **導覽 CTA 就是 `.btn`**，不另立定義。48px 高度放在 64px 的導覽列裡上下各餘 8px。先前的 `.nav-cta` 只在幾個像素上與按鈕不同，那正是兩顆按鈕開始漂移的方式

#### `.btn-quiet`——這一支是本規範原本沒有的

規範定義**一顆**按鈕，並規定每個 section 最多一顆。版面章節正朝那個方向走，但在那些 section 被重建之前，有四個頁面把主要 CTA 與次要 CTA 並排；把兩者做成同一顆控制項會讀成失誤。

`.btn-quiet` 與 `.btn` 同幾何，改用分隔線權重的邊框與 muted 標籤。**它應該隨著版面票逐一消失**；如果版面做完它還在，那就是「每個 section 最多一顆按鈕」這條沒有真的守住的訊號。

**代價已知並接受**：按鈕字距從 `0.2em` 收成 `0`，等於拿掉拉丁簽名的三個承載點之一（導覽、eyebrow、按鈕）。剩下兩個仍然是 `0.09em` 大寫。

### 導覽

固定在頂、半透明 + backdrop blur、底部一條 `--line`。

- 品牌字標：`font-display`、uppercase、`0.09em`
- 連結：`text-nav`（13px / `0.09em` / uppercase）、靜止 `text-ink-muted`、hover `text-ink`
- hover 時底線由右向左展開（`scale-x` + `transform-origin` 切換），**只動 transform，不動 opacity**
- CTA 用 `.btn`

大螢幕的次要連結收在全螢幕覆蓋選單裡。覆蓋層的 markup 永遠在文件中，所以爬蟲看得到。

### Eyebrow

`text-eyebrow`（12px / `0.09em` / uppercase / `text-ink-body`）。用在章節編號、欄標題、kicker。

章節編號用等寬：`01 — SERVICES`。

### 標籤 / Tag

`text-eyebrow` + `1px solid var(--line)` + `border-radius: var(--radius-control)`。標籤是互動控制項的近親，所以吃控制項圓角。

### 引言

左側一條 `1px solid var(--line-strong)`，`padding-left`，**不加彩色條、不加引號圖形、不斜體**——中文的合成斜體是把字硬拉歪，不是 italic。

### 內容區塊不畫外框

區隔靠**間距、標題層級與必要的髮絲分隔線**（`border-t` / `border-l`），不靠把每一段內容關進方塊。

先前的規則是「卡片是髮絲框，不是填色」，那讓 14 條路由累積出 162 個全框方塊，其中 49 個是框中框——外層一個框裝著三個小框，讀起來是雜訊不是結構。

**外框保留給互動控制項**（按鈕、標籤、頭像），因為那些拿掉邊界就消失了；以及 `claude-skills-guide` 的簡報版型模擬，那裡的方塊本身就是被描繪的對象。

---

## 版面

三種頁型，三種節奏。參考站只有第一種，另外兩種是本站推導。

### 行銷頁（`/`、`/about`、`/ai-smart-work`、`/data-governance`、`/building`）

採參考站的滿版節奏：

- 每個主要 section 高度約一個視窗（`min-h-[86vh]` 起跳，實測參考站為 902–941px）
- **單欄**。左右對照的「文案 + 產品截圖」是 SaaS 落地頁文法，不是這套語彙
- 文案壓在**左中或左下**，不置中
- 內文欄寬窄：`max-w-[42ch]`（參考站實測約 370px）
- 每個 section **最多一顆按鈕**
- 背景是滿版生成式圖形（見下節）

### 長文頁（7 條指南）

保持連續的閱讀流，**不切成滿版屏**。參考站沒有長文頁，所以在這件事上沒有答案可抄；把一篇 GEO 指南拆成幾十屏會同時毀掉連續閱讀與 `Ctrl+F`。

節奏改由這三樣承擔：

- 放大的章節間距（`mt-32` 級距，不是 `mt-12`）
- 等寬章節編號 + eyebrow
- 章節之間一條 `border-t border-line`

閱讀寬度 `max-w-prose`（`68ch`）。中文排得比拉丁密，舒適行長比慣用的 75ch 短。

### 法務頁與 404

只跟進 token 層（墨色、字距、圓角、字體）。版面不動。

---

## 動態

**捲動揭示動畫全面禁用。** 這不是本站的潔癖——參考站實測**零個**：折線下 17 個元素沒有一個 `opacity < 1`，沒有 transform，沒有 IntersectionObserver。內容不管捲到哪裡都是畫好的。

本站也有自己的理由。曾經有過一版用 JS 設 `opacity-0` 再由 IntersectionObserver 解除，快速捲動會超過觀察器，元素永久隱形（首頁一度有 19 個），而且讓內文的可見性取決於 JS 執行成功。

允許的動態只有三種：

| 動態 | 規則 |
|---|---|
| hover / focus 過場 | `.5s cubic-bezier(.19, 1, .22, 1)`，只動 `background-color`、`color`、`transform` |
| 視差 | **只寫 `transform`，絕不碰 `opacity`** |
| τ 曲線與生成式圖形 | 見下節 |

**進場逐層淡入（`animate-stagger-*`）移除。** 參考站沒有這個東西，而且它讓 hero 標題的可見時間比實際畫好的時間晚 100–300ms——那個元素通常就是 LCP。

`check:design` 檢查模板裡沒有以 `opacity-0` 起始、依賴腳本解除的元素。

---

## 視覺元素

**本站不使用攝影。**

參考站的版面之所以成立，是因為每個滿版 section 底下都有一張火箭或火星（實測 4 支影片、5 張圖）。把版面搬過來卻沒有那個等級的影像，拿到的是空的黑色區塊。除此之外還有三個具體問題：

- CSP 是 `img-src 'self' data:`，影像必須自架
- **對比稽核在影像上是瞎的**。`contrast.js` 是把 alpha 沿祖先鏈合成後比對計算出的背景色，它看不到背景圖；白字壓在淺色照片上會**通過閘門**卻實際不可讀
- 長文頁的 LCP 是整套字體策略存在的唯一理由，滿版影像會直接變成新的 LCP 元素

滿版視覺改由**畫面級的生成式圖形**承擔，畫在 `<canvas>` 上：

- **τ 曲線**（既有）：二階欠阻尼系統的階躍響應。τ 是時間常數，這條曲線就是它的定義圖
- 極座標格網、訊號干涉圖等同族圖形，每個主要 section 一張

好處是零彩色不變、canvas 不是 LCP 候選、對比閘門不會被弄瞎。

### τ 曲線的實作約束

首頁描繪一次後緩慢呼吸；長文頁是靜態細帶。

描繪階段用 `requestAnimationFrame`，**收斂後的呼吸改用計時器（30fps）**。不要把呼吸改回 rAF：那會讓主執行緒以螢幕更新率被喚醒卻什麼都不畫。離開視窗或分頁隱藏時完全停止。

顏色從 CSS 變數讀（`tau-curve.js` 與 `prompt-injection-chart.js` 都已如此），所以換色自動跟上。

### hero 曲線的遮罩

曲線是滿版且在文案底下。它在每個視窗寬度都會穿過標題的方框，而中文字是細筆劃寬間距，一條髮絲線從字縫穿過會被讀成壓在字上面。

解法是把曲線在文案欄的位置**淡出**（`mask-image` 水平漸層），而不是在文字後面加一塊底板或遮罩——這套語彙沒有底板，卡片是髮絲外框，永遠不是填色。曲線在右側保留全部重量，那才是它的掃掠真正讀得到的地方。

停點是水平的，因為文案是置中容器裡的左對齊欄，要保護的區域是一條垂直帶而不是一個方框。

---

## 衍生資產

換 token 時**這些不會自己跟上**，必須同一批改完並重跑 `npm run build:assets`：

| 資產 | 情況 |
|---|---|
| `scripts/assets/build-og.js` | **硬寫死** `#fff`、`#c8c8cc`、`#8a8a91`、`letter-spacing: 0.25em`。不改它，15 張 OG 分享卡會停在舊語彙 |
| `scripts/assets/build-icons.js` | 硬寫死 `#000000` 背景。黑色不變，不用改 |
| `scripts/assets/build-logo.js` | 硬寫死 `#ffffff`。結構化資料 logo 用在**淺色底**（Google 的卡片），與站內墨色無關，不要跟著改成 `#F0F0FA` |

OG 卡是唯一一種**在網站外面被看到、卻不會有人在瀏覽器裡發現不對**的資產。改 token 時最容易漏掉的就是它。

---

## 檢查

新增 `npm run check:design`，接進 `.github/workflows/checks.yml`，門檻設在**乾淨**而非「不要更糟」——趁現在乾淨時設，才不需要維護一份豁免清單。

檢查項目：

| 檢查 | 規則 |
|---|---|
| 零 hex | `templates/**/*.html` 裡不得出現 hex 顏色值（含行內 `style` 與 `<style>` 區塊）。**現況已經是 0**，門檻設在維持。比對前必須先遮蔽數字字元參照（`&#123;`）與片段連結（`href="#contact-us"`），否則兩者都會被誤判成顏色 |
| 字距 | `tracking-[...]` 的任意值只能取自刻度（`0`、`0.09em`、`0.02em`、`-0.017em`）。其餘一律報錯 |
| 圓角 | `rounded-*` 只允許出現在互動控制項（`button`、`a.btn`、`input`、`select`、`.tag`）與 `rounded-full` |
| 捲動揭示 | 不得有以 `opacity-0` 起始、由腳本解除的元素。**唯一的結構性豁免是全螢幕覆蓋選單**（`#menuOverlay`）——它的靜止態由點擊解除而非捲動解除，沒有觀察器也沒有捲動監聽，內容無論如何都在文件裡。豁免以 id 具名寫在檢查器中而非用樣式比對，這樣第二個豁免不可能在沒人開口的情況下被加進去 |
| 標題結構 | 每個 `<h1>` 必須含 `.display-lead` 與 `.display-sub` 兩行。範圍由 `site.toml` 決定而非掃目錄，所以新增的頁面沒辦法安靜地漏掉這條 |

**五條規則不會同時開啟。** 其中三條描述的是還沒發生的遷移，今天全部不成立；它們隨著讓它們成立的那次改動各自開啟（字距在元件層、標題結構在 H1 遷移、圓角在最後一條帶圓角的路由遷移完）。這樣 CI 一路綠燈而不需要豁免清單——**用關掉規則換綠燈和用豁免清單換綠燈是同一件事**，差別只在前者誠實。檢查器會列出尚未開啟的規則與負責開啟它的票號。

`check:design` 讀 `templates/` 與 `site.toml`，不解析 CSS 產物——它檢查的是**作者寫下的意圖**，`check:classes` 才是檢查 Tailwind 有沒有真的產出東西的那一道。兩道都需要。

現有六道閘門（`check:css`、`check:classes`、`check:llms`、`check:dates`、`check:jsonld`、`contrast`、`contract`）不因這次改版放寬。特別注意：

- **`styles.min.css` 是進版控的建置產物。** 改完模板沒重建就會靜默失效——`.md:h-20` 曾經沒進去，七個頁面的曲線細帶少了 16px 而毫無跡象。每階段結束跑 `npm run build:css`
- **`?v=` 版號是手動的。** 換 token 後遞增 `header.html` 裡的 `styles.min.css?v=`
- **預覽一定要用 `npm run serve`（wrangler）。** 一般靜態伺服器不讀 `_headers`，一條永遠匹配不到的規則在它上面看起來完全正常

---

## 詞彙表

這些名稱在模板、CSS、檢查器與這份文件裡指同一件事。用別的說法之前先改這裡。

| 詞 | 意思 |
|---|---|
| **surface** | 背景。`deep` 是全幅 section，`base` 是頁面基底，`raised` 是需要層次的面板 |
| **ink** | 文字。單一顏色 `#F0F0FA`，層級靠 alpha |
| **line** | 髮絲線。只有兩個權重：`line` 分隔、`line-strong` 控制項邊緣 |
| **control** | 摸得到的互動元素——按鈕、輸入框、下拉、標籤。**唯一吃圓角與外框的東西** |
| **eyebrow** | 標題上方的小型大寫拉丁標籤。章節編號、欄標題、kicker |
| **lead / sub** | 標題的兩行。`lead` 是拉丁全大寫領銜行，`sub` 是中文副標 |
| **display** | 顯示級字體與字級（`display-sm` / `md` / `lg`）。一律 Bold + 大寫，只給拉丁 |
| **hairline** | 1px 的線。這套語彙裡沒有比 1px 粗的分隔 |
| **τ 曲線** | 二階欠阻尼系統的階躍響應。品牌圖形，不是裝飾線條 |
| **行銷頁 / 長文頁 / 法務頁** | 三種版面節奏，見「版面」 |

---

## 決策紀錄

每條規則背後的依據或代價。**改規則之前先讀對應那條**——下面每一項都是某次「順手改一下」造成的。

| # | 決策 | 依據 / 代價 |
|---|---|---|
| 1 | 設計規範集中在這一個檔案 | 先前散在 `NOTES.md`、`input.css`、`tailwind.config.js`，其中兩處已與現況不符且沒人發現 |
| 2 | 以 `www.spacex.com` 的實測值為準 | 「風格接近」無法檢查，數字可以 |
| 3 | 單一墨色 + alpha | 參考站實測只有 `#F0F0FA` 一色。內文放 0.8 而非 0.9，是為了維持與遷移前 `#c8c8cc` 同階的抗光暈亮度 |
| 4 | 中文走系統字體 | 繁中網頁字體切片後仍數百 KB 且 swap 重排。**Windows 的中文比 Mac 差一階，已知並接受** |
| 5 | `line-height 0.9` 只給拉丁 | 中文字身滿框，沒有 descender 空隙，0.9 會裁到筆劃 |
| 6 | 英文領銜 + 中文副標 | 中文沒有大寫，參考站的標題簽名只能由拉丁行承載。**代價：H1 的主要文字變成英文**，長文內部 H2 因此保留中文 |
| 7 | 小型大寫收到 `0.09em` | 實測值。遷移前的 `0.2em` / `0.25em` 約是參考站的兩倍 |
| 8 | 按鈕字距收成 `0` | 實測值。**代價：拉丁簽名的三個承載點少一個** |
| 9 | 圓角只給控制項 | 參考站實測（控制項 4px、縮圖 8px、社群鈕正圓）。遷移前的全域 0 比參考站更嚴格 |
| 10 | Tailwind 未用到的 `borderRadius` 階不能刪 | 刪掉後後來寫的 `rounded-md` 會落回 `0.375rem`，方角規則無聲破掉 |
| 11 | 自架 Roboto Mono | 等寬已在 7 個模板出現 33 次 + 24 個 code 區塊，卻交給系統堆疊——三台機器三種面貌，那樣不算設計的一部分 |
| 12 | 內容區塊不畫外框 | 「卡片是髮絲框」讓 14 條路由累積出 162 個全框方塊，其中 49 個是框中框 |
| 13 | 不用捲動揭示動畫 | 參考站實測 0 個。本站也有前科：IntersectionObserver 版本讓首頁 19 個元素永久隱形 |
| 14 | 移除進場逐層淡入 | 參考站沒有，且它讓 LCP 元素的可見時間晚 100–300ms |
| 15 | 不使用攝影 | 沒有火箭。加上 CSP `img-src 'self'`、對比稽核在背景圖上是瞎的、滿版影像會成為新的 LCP 元素 |
| 16 | 長文頁不切滿版屏 | 參考站沒有長文頁。切屏會同時毀掉連續閱讀與 `Ctrl+F` |
| 17 | τ 曲線呼吸用計時器不用 rAF | rAF 會讓主執行緒以螢幕更新率被喚醒卻什麼都不畫 |
| 18 | hero 曲線用遮罩淡出而非底板 | 這套語彙沒有底板；卡片是髮絲外框，永遠不是填色 |
| 19 | 規則配 CI 閘門 | 這個 repo 已經實證過靠 review 守不住：CSP 一年未生效、hex 規則寫了就破、55 個無效 class |
| 20 | `build-logo.js` 的白色不跟著改 | 結構化資料 logo 用在淺色底，與站內墨色無關。曾經有人把「深色底用的白色標記」誤當成「深色的 logo」放進 JSON-LD，Google 收到一張白底白字 |
