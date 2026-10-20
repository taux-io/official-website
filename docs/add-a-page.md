# 新增、搬動或刪除一個頁面

`site.toml` 的一條路由，產生器、`contract`、`contrast` 和分享圖建置器就都認得它（檔頭那句「Adding a page here is enough」說的是這個）。其餘的是帳本和閘門：少動任何一個，會有一道閘門變紅。每一步的最後一行寫著「做完的樣子」。

## 步驟

1. **`site.toml` 加 `[[page]]`。** 照 `/what-is-mcp` 或 `/agent-dev-workflow` 的寫法。
   - 欄位定義在 `generator/src/site.rs`（`Page`、`LocaleText`）。`canonical` 與非正典 locale 的 `template` 留空，由 `Site::derive` 推出。
   - `section = "article"` 的頁面要有 `service`，值是某個服務頁的路徑；指到非服務頁時 build 失敗。
   - 麵包屑用 `{{ breadcrumb }}` 的模板，頁面要有 `crumb`。
   - `date_published` 不晚於 `date_modified`。
   - 只做一個 locale：`[page.locale]` 底下只寫那一個 locale。產生器支援它（沒有 `alternates`、不畫語言切換器、其他 locale 的選單不連過來）。
   - 做完的樣子：`npm run build:site` 之後，`dist/<locale>/<slug>.html` 與 `.md` 都在。
2. **`site.toml` 檔尾加 `[[redirect]]`：** `from = "/<slug>"`、`to = "/<locale>/<slug>"`。做完的樣子：`npm run contract` 斷言 `/<slug>` 轉到 `/<locale>/<slug>`。
3. **模板放 `templates/<slug>.html`。** 骨架抄同類頁（長文指南照 `agent-dev-workflow.html`）。站內連結一律 `/{{ locale }}/…`。
   - CSP（`_headers`）是 `script-src 'self'`、`style-src 'self'`：樣式放 `src/input.css`，跑 `npm run build:css`，把 `static/css/styles.min.css` 一起 commit；腳本放 `static/js/`，模板用 `?v={{ js_version["<檔名>"] }}` 引入（前例：`what-is-mcp.html` 引入 `mcp-primitives.js` 的那一行）。inline `<script>`、`<style>`、`style=` 會被擋。
   - 預覽用 `npm run serve`：它套用 `_headers`，CSP 違規在本機就看得到；不套用標頭的靜態伺服器看不到。
   - 做完的樣子：`npm run check:css`、`check:classes`、`check:design` 綠，`npm run serve` 上頁面的 console 沒有 CSP 違規。
4. **`npm run routes:record`**，把 `ledgers/published-paths.txt` 一起 commit。做完的樣子：`npm run check:routes` 綠。
5. **`public/llms.txt` 手寫**：頁面有幾個 locale 就寫幾行（`/what-is-mcp` 五行；單一 locale 的頁面一行），格式照同一區段的其他條目。做完的樣子：`npm run check:llms` 綠。
6. **分享圖，每個 locale 一張**（`static/og/<locale>/<slug>.png`）。`npm run build:og` 要在 `npm run build:site` 之前跑，因為 `build:site` 才把 `static/` 複製進 `dist/`。只 commit 這個頁面新增的卡，其餘用 `git checkout -- static/og` 還原（理由見 `NOTES.md`）。做完的樣子：`npm run contract` 沒有 `share image … answers 404`。
7. **`npm run check`**，然後跑 `NOTES.md` 的 audit 一節（先 `npm run serve`）。

自動的，不用動：`sitemap.xml`、`insights` 文章列表（`section = "article"`）、Markdown 副本。

## 會踩到的事

- **`check:dates` 用 UTC 的今天。** 台灣時間 00:00–08:00 之間，寫台灣當天的日期會被判成「未來」。等到 08:00 之後，或寫前一天。
- **`check:locale-drift` 只警告、永遠 exit 0。** 單一 locale 的頁面會被標成「只改了部分 locale」，是預期的雜訊。
- **本機 Chromium 版本對不上。** 不用設任何變數：`scripts/browser.js` 找不到 Playwright 的 headless shell（`Executable doesn't exist at …/chromium_headless_shell-…`）時，會自動改用本機 Google Chrome，並印一行 `browser: … using local Google Chrome`。本機也沒有 Chrome 才會報錯，訊息會說要裝什麼。想指定別的瀏覽器才設 `PLAYWRIGHT_CHANNEL=msedge`（有設就照設的用，不自動換）。理由與細節見 `NOTES.md`、`scripts/browser.js`。
- **新增 `check:*` 腳本時**，`package.json` 的 `check` 串和 `.github/workflows/checks.yml` 的 `build` job 兩處一起加，順序一致。`NOTES.md` 警告過：文件裡不放閘門的總數。
