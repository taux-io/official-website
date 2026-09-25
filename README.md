# TauX 拓思科技股份有限公司 — 官方網站

https://taux.io 的原始碼。TauX 做 GEO（生成式引擎優化）、AI Agent 開發、軟體平台建置與企業 AI 內訓，公司在高雄岡山。

這份 README 只講**怎麼開始**。其餘每件事都有唯一的出處，這裡只指路，不重述——重述的那一份遲早會過時，而過時的文件看起來和正確的一樣（這份 README 先前就是如此：它描述的黑底、自架字體、兩個語言和短影片服務，全都已經不存在）。

| 想知道 | 看 |
|---|---|
| 建置、閘門、技術決策的現況 | [NOTES.md](NOTES.md) |
| 設計規範與設計決策紀錄（唯一來源） | [DESIGN.md](DESIGN.md) |
| 部署、主機設定、上線後怎麼驗 | [DEPLOYMENT.md](DEPLOYMENT.md)（部署的唯一依據） |
| 專案用語：路由、locale、閘門… | [CONTEXT.md](CONTEXT.md) |

## 架構一句話

建置時把模板算成靜態檔，Cloudflare Workers 從邊緣供應。

- **Generator**：Rust（`generator/`），用 minijinja 把 `templates/` 依 `site.toml` 算成 `dist/`，連同 sitemap、`_redirects` 與每頁的 Markdown 雙生檔
- **前端**：靜態 HTML + Tailwind CSS 3.4，系統字體堆疊，沒有前端框架
- **Locale**：五個——`zh-Hant-TW`（正典）、`zh-Hans-CN`、`en-US`、`ja-JP`、`ko-KR`，每條路徑都帶 locale 前綴
- **執行期**：唯一會跑的程式碼是 `src/worker.js`，只處理 `/` 的語言協商；它從不自己組回應，所以 `_headers`（含 CSP）照樣套用
- **工具鏈**：Node 負責 CSS、資產生成與所有檢查（`scripts/`）

## 目錄

```
site.toml          每一條路由只在這裡宣告一次：路徑、模板、各 locale 的 title / description / 日期
generator/         Rust 靜態網站產生器
templates/         zh-Hant-TW 正本與共用 partial（header、footer、_*.html）
templates/<locale>/  其他四個 locale 的頁面
src/input.css      Tailwind 來源與設計 token → static/css/styles.min.css（進版控）
src/worker.js      `/` 的語言協商
static/            原樣發佈的資產：css、js、og 分享卡、brand、favicon、robots.txt、llms.txt
brand-src/         不發佈的原始素材（build-logo.js 的裁切來源）
scripts/           檢查閘門、資產生成、視覺稽核
_headers           標頭、快取與 CSP
wrangler.jsonc     部署拓撲
```

## 開始

Node 與 Rust 的版本由 `.nvmrc` 與 `rust-toolchain.toml` 釘住，nvm 與 rustup 會自己讀。

```bash
npm ci
npm run build:css    # src/input.css → static/css/styles.min.css
npm run build:site   # templates/ + site.toml → dist/
npm run serve        # wrangler dev，http://127.0.0.1:8099
```

**預覽一定要用 `npm run serve`。** 一般的靜態伺服器不讀 `_headers`，一條永遠匹配不到的標頭規則在那裡看起來完全正常——這個站的 CSP 曾經因此一整年沒有生效而沒人發現。

改 CSS 時開 `npm run watch:css`。改了模板裡的 class 要重建 CSS，`styles.min.css` 是進版控的建置產物，`npm run check:css` 會擋。

## 檢查

CI（`.github/workflows/checks.yml`）在每個 PR 跑兩個 job：`build` 跑離線的檢查，`audit` 在 wrangler 供應的 `dist/` 上跑瀏覽器稽核。**合併進 `main` 就是上線**，所以 CI 是唯一的關卡。

每一道閘門做什麼、為什麼存在，列在 [NOTES.md 的「建置與檢查」](NOTES.md)——那份清單是唯一來源，這裡不重複。

## 新增一頁

1. 在 `templates/` 寫 zh-Hant-TW 正本，其他 locale 放在 `templates/<locale>/`（簡體可用 `node scripts/hans.js` 起稿）
2. 在 `site.toml` 加一個 `[[page]]`，每個 locale 一段 `[page.locale.<tag>]`
3. 導覽連結在 `templates/_nav-columns.html`，連結文字在 `site.toml` 每個 `[[locale]]` 的 `[locale.strings]`（`nav_*`）
4. 在 `static/llms.txt` 列出它（`check:llms` 會擋），`npm run build:og` 產生分享卡

sitemap、hreflang、OG 標籤、路由契約測試都從 `site.toml` 推導，不用手改。日期（`date_published`、`date_modified`）寫在 `site.toml`，建置不讀 git；`npm run dates` 會拿 git 的紀錄跟宣告值對照（只報告）。

## 聯絡

- hello@taux.io · +886-7-6211033
- 高雄市岡山區文賢路 57 號 2 樓

© 2026 TauX 拓思科技股份有限公司。保留所有權利。
