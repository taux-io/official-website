新 clone 先跑 `npm run hooks:install`，否則 commit 前不會掃密碼（這個 repo 是公開的）。

送 PR 前跑 `npm run check`：和 CI 的 `build` job 同一串。`audit` job（contrast、contract、geometry、cards）要 Chromium，另外跑。

- 改顏色、字體、間距、元件、動態：先讀 `DESIGN.md`，它是設計詞彙的唯一來源。
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
