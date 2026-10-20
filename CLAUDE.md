新 clone 先跑 `npm run hooks:install`，否則 commit 前不會掃密碼（這個 repo 是公開的）。

送 PR 前跑 `npm run check`：和 CI 的 `build` job 同一串。`audit` job（contrast、contract、sharks、geometry、cards）要 Chromium，另外跑 `npm run audit`（自己挑埠起伺服器、依序跑完五項、只回一個 exit code；約 15 分鐘以上）。

- 改顏色、字體、間距、元件、動態：先讀 `DESIGN.md`，它是設計詞彙的唯一來源。
- 改首頁鯊魚背景（`static/js/home-sharks.js`、`static/js/sharks-sim.js`、`--shark-N-rgb`、紙色、墨色）：跑 `npm run check:hero-sharks`（文字最壞對比、色調數量與一致、兩支腳本合計 ≤ 14336 位元組、hero 內禁用 `text-ink-soft`）與 `npm run sharks`、`npm run test:sim`。手機、減少動態與後備用的靜態圖暫時仍是舊的水面圖（#401 重做），沒有帳本也沒有 `build:sharks`。
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
