新 clone 先跑 `npm run hooks:install`，否則 commit 前不會掃密碼（這個 repo 是公開的）。

送 PR 前跑 `npm run check`：和 CI 的 `build` job 同一串。`audit` job（contrast、contract、sharks、geometry、cards）要 Chromium，另外跑 `npm run audit`（自己挑埠起伺服器、依序跑完五項、只回一個 exit code；約 15 分鐘以上）。

- 改顏色、字體、間距、元件、動態：先讀 `DESIGN.md`，它是設計詞彙的唯一來源。
- 改首頁鯊魚背景（`static/js/home-sharks.js`、`static/js/sharks-sim.js`、`--shark-N-rgb`、紙色、墨色）：跑 `npm run check:hero-sharks`（文字最壞對比、色調數量與一致、兩支腳本合計 ≤ 16384 位元組、hero 內禁用 `text-ink-soft`、靜態圖沒過期）、`npm run sharks` 與 `npm run test:sim`。手機（直圖）與平板、減少動態、後備（橫圖）用的兩張靜態圖是模擬在固定時間點畫的：改了模擬、色調、紙色、墨色、字格尺寸、固定時間或種子，`check:hero-sharks` 會紅，照它的訊息跑 `npm run build:sharks && npm run build:css`（本機沒有 Playwright 的 Chromium 會自動改用 Chrome），把 `static/brand/hero-sharks-landscape.webp`、`static/brand/hero-sharks-portrait.webp`、`ledgers/hero-sharks-still.txt`、`src/input.css`、`static/css/styles.min.css` 一起 commit。挑固定時間：`node scripts/assets/build-sharks.js --scan`，把結果寫進 `scripts/lib/sharks-source.js` 的 `STILLS`。
- 新增、搬動或刪除頁面，或本機 Chromium 版本對不上、audit 起不來：照 `docs/add-a-page.md`。
- 部署、Cloudflare、`src/worker.js`：照 `DEPLOYMENT.md`。
- 想知道某個決定為什麼這樣做：查 `NOTES.md`。

## Agent skills

### Issue tracker

GitHub Issues (via `gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default five labels, each named after its role. See `docs/agents/triage-labels.md`.

### Domain docs

single-context. See `docs/agents/domain.md`.
