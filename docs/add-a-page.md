# 新增、搬動或刪除一個頁面

一個頁面不是一個檔案：它是 `site.toml` 的一條路由，加上五個地方要跟著動。少動任何一個，會有一道閘門變紅；下面每一步的最後一行寫著「做完的樣子」。

## 步驟

1. **`site.toml` 加 `[[page]]`。** 照 `/what-is-mcp` 或 `/agent-dev-workflow` 的寫法。
   - 欄位定義在 `generator/src/site.rs`（`Page`、`LocaleText`）。`canonical` 和非正典 locale 的 `template` 由 `Site::derive` 推出，不要寫。
   - `section = "article"` 的頁面要有 `service`，值必須是某個服務頁的路徑，否則 build 失敗。
   - 麵包屑用 `{{ breadcrumb }}` 的模板，頁面要有 `crumb`。
   - `date_published` 不能晚於 `date_modified`。
   - 只有一個 locale 的頁面：`[page.locale]` 底下只寫那一個 locale。產生器支援它（沒有 `alternates`、不畫語言切換器、其他 locale 的選單不連過來）。
   - 做完的樣子：`npm run build:site` 之後 `dist/<locale>/<slug>.html` 與 `.md` 都在。
2. **`site.toml` 檔尾加 `[[redirect]]`：** `from = "/<slug>"`、`to = "/<locale>/<slug>"`。
3. **模板放 `templates/<slug>.html`。** 骨架抄同類頁（長文指南照 `agent-dev-workflow.html`）。站內連結一律 `/{{ locale }}/…`。
   - 樣式與腳本的限制來自 CSP（`_headers`）：`script-src 'self'`、`style-src 'self'`。頁面裡不能有 inline `<script>`、`<style>`、`style=`。
   - 新 class 放 `src/input.css`，然後 `npm run build:css`，把 `static/css/styles.min.css` 一起 commit。
   - 新腳本放 `static/js/`，模板用 `?v={{ js_version["<檔名>"] }}` 引入（前例：`what-is-mcp.html` 引入 `mcp-primitives.js` 的那一行）。
   - 預覽用 `npm run serve`：它套用 `_headers`，所以 CSP 違規在本機就看得到；任何不套用標頭的靜態伺服器都看不到。
4. **`npm run routes:record`**，把 `ledgers/published-paths.txt` 一起 commit。做完的樣子：`npm run check:routes` 綠。
5. **`public/llms.txt` 手寫一行**，格式照同一區段的其他條目。做完的樣子：`npm run check:llms` 綠。
6. **分享圖。** `npm run build:og` 要在 `npm run build:site` 之前跑，因為 `build:site` 才把 `static/` 複製進 `dist/`；順序顛倒時 `contract` 報 `share image … answers 404`。
   - `build:og` 每次重畫全部的卡。換了一套 Chromium 之後，既有卡的位元組都會變：只 commit 新頁面那一張，其餘 `git checkout -- static/og`。
7. **`npm run check`**，然後依 `NOTES.md` 跑 audit 那組（`contrast`、`contract`、`geometry`、`cards`，先 `npm run serve`）。

自動的，不用動：`sitemap.xml`、`insights` 文章列表（`section = "article"`）、Markdown 副本。

## 會踩到的事

- **`check:dates` 用 UTC 的今天。** 台灣時間 00:00–08:00 之間，寫台灣當天的日期會被判成「未來」。等到 08:00 之後，或寫前一天。
- **`check:locale-drift` 只警告、永遠 exit 0。** 單一 locale 的頁面會被標成「只改了部分 locale」，是預期的雜訊。
- **本機 Chromium 版本對不上。** `contrast`、`contract`、`geometry`、`build:og` 報 `Executable doesn't exist at …/chromium_headless_shell-…`，就是這個：Playwright 要的版本和機器上裝的不同。加 `PLAYWRIGHT_CHANNEL=chrome`（細節在 `scripts/browser.js` 開頭）。
- **每個 worktree 有自己的 `generator/target`。** `build:site` 用 `cargo run`，任何建置資料夾都行；同時開幾個 worktree 時，共用一個 `CARGO_TARGET_DIR` 可以省掉重建。
- **新增 `check:*` 腳本時**，`package.json` 的 `check` 串和 `.github/workflows/checks.yml` 的 `build` job 要一起加，順序一致。`NOTES.md` 警告過：文件裡不要放閘門的總數。
