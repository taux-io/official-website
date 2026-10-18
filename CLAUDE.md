新 clone 先跑 `npm run hooks:install`，否則 commit 前不會掃密碼（這個 repo 是公開的）。

送 PR 前跑 `npm run check`：和 CI 的 `build` job 同一串。`audit` job（contrast、contract、geometry、cards）要 Chromium，另外跑。

- 改顏色、字體、間距、元件、動態：先讀 `DESIGN.md`，它是設計詞彙的唯一來源。
- 部署、Cloudflare、`src/worker.js`：照 `DEPLOYMENT.md`。
- 想知道某個決定為什麼這樣做：查 `NOTES.md`。
