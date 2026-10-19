新 clone 先跑 `npm run hooks:install`，否則 commit 前不會掃密碼（這個 repo 是公開的）。

送 PR 前跑 `npm run check`：和 CI 的 `build` job 同一串。`audit` job（contrast、contract、water、geometry、cards）要 Chromium，另外跑。

- 改顏色、字體、間距、元件、動態：先讀 `DESIGN.md`，它是設計詞彙的唯一來源。
- 改首頁水面（`static/js/home-water.js` 的著色器或 `WATER_MAX_DEPTH`、`--water-rgb`、紙色）：`npm run check:hero-water` 會變紅，因為手機用的靜態圖是舊的；照它的訊息跑 `PLAYWRIGHT_CHANNEL=chrome npm run build:water` 與 `npm run build:css`，把圖、`ledgers/hero-water-still.txt`、`src/input.css`、`static/css/styles.min.css` 一起 commit。
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
