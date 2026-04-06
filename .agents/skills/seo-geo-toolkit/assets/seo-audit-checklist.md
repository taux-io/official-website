# SEO/GEO 審計清單 (10 Categories)

> Reviewer Agent 的標準驗證框架。每個類別都必須逐項檢查並評級。

## 評級標準

| 等級 | 符號 | 意義 | 動作 |
|------|------|------|------|
| Critical | 🔴 | 嚴重違規，影響 AI 可讀性或 SEO 表現 | 必須修正，阻擋上線 |
| Warning | 🟡 | 偏離建議，功能正常但有改善空間 | 建議修正 |
| Pass | 🟢 | 符合規範 | 無需動作 |

---

## Category 1: Schema.org 結構化數據

- [ ] 頁面包含至少一個 JSON-LD `<script type="application/ld+json">` 區塊
- [ ] `@type` 與頁面內容匹配（TechArticle / FAQPage / WebPage / HowTo）
- [ ] 所有必填欄位已填寫（name, description, url）
- [ ] `publisher` 包含 Organization 資訊
- [ ] JSON-LD 語法有效（無逗號錯誤、引號問題）
- [ ] FAQ 頁面使用 `FAQPage` + `Question` + `Answer` 三層結構

## Category 2: Meta Tags

- [ ] `<title>` 存在且長度 30-60 字元
- [ ] `<meta name="description">` 存在且長度 120-160 字元
- [ ] `<link rel="canonical">` 指向正確 URL（無 `.html` 後綴）
- [ ] Open Graph tags 存在（og:title, og:description, og:type, og:url）
- [ ] `<meta name="viewport">` 設定正確
- [ ] Title 和 Description 不重複使用於多個頁面

## Category 3: Heading 層級結構

- [ ] 每頁只有一個 `<h1>` 標籤
- [ ] H1 包含頁面核心關鍵字
- [ ] Heading 層級不跳級（H1 → H2 → H3，非 H1 → H3）
- [ ] H2 用於主要段落分隔
- [ ] Heading 內容具描述性（非 "Section 1" 等泛用文字）

## Category 4: FAQ Schema 合規

- [ ] FAQ 區塊使用 `<details>` + `<summary>` 或等效語意標記
- [ ] FAQ 內容與 `FAQPage` Schema 同步
- [ ] 問題使用自然語言格式（用戶實際會問的問題）
- [ ] 答案簡潔（50-200 字），直接回答問題
- [ ] 至少包含 3 個 FAQ 項目

## Category 5: llms.txt 同步

- [ ] `static/llms.txt` 存在且格式正確（Markdown）
- [ ] 公司描述與首頁一致
- [ ] 所有公開頁面都列在「資源與連結」區塊
- [ ] URL 使用 clean path（無 `.html`）
- [ ] 聯絡資訊與 footer 一致

## Category 6: robots.txt 設定

- [ ] 允許所有主要 AI 爬蟲（GPTBot, ClaudeBot, GoogleOther, PerplexityBot）
- [ ] 阻擋不需索引的路徑（/admin/, /static/css/, /static/js/）
- [ ] Sitemap URL 正確指向 `https://taux.io/sitemap.xml`
- [ ] 無意外的 `Disallow: /` 全站封鎖

## Category 7: sitemap.xml 完整性

- [ ] 所有公開路由都已列入
- [ ] URL 使用 clean path（與 Go routes 一致）
- [ ] `<lastmod>` 日期合理（非未來日期、非過舊）
- [ ] `<priority>` 分級合理（首頁 1.0, 主要頁面 0.8, 輔助頁面 0.3-0.5）
- [ ] 無已刪除或 404 的頁面殘留

## Category 8: 內部連結與 Canonical

- [ ] 每頁至少 2 個指向其他頁面的內部連結
- [ ] 連結使用描述性 anchor text（非「點這裡」）
- [ ] 無斷鏈（所有 `<a href>` 指向有效路徑）
- [ ] Canonical URL 與實際 URL 一致
- [ ] 導覽列（header.html）包含所有主要頁面

## Category 9: 語意密度與答案容器

- [ ] 核心內容使用表格、列表或 Q&A 等結構化格式
- [ ] 段落長度合理（3-5 句為一段）
- [ ] 避免模糊用語，使用具體數據或引用
- [ ] 技術術語有 `<abbr>` 或首次出現時解釋
- [ ] 比較型內容使用表格（如 GEO vs SEO）

## Category 10: 圖片與 Accessibility

- [ ] 所有 `<img>` 有 `alt` 屬性
- [ ] SVG 插圖有 `aria-label` 或 `<title>` 描述
- [ ] 互動元素有 `aria-label`（特別是 hamburger menu、accordion）
- [ ] 色彩對比符合 WCAG AA（文字 vs 背景 ≥ 4.5:1）
- [ ] 聚焦狀態可見（keyboard navigation）

---

## 審計摘要模板

```markdown
# SEO/GEO 審計報告

**審計時間**: [YYYY-MM-DD]
**目標頁面**: [URL]
**審計者**: SEO/GEO Reviewer Agent

## 總覽
| 類別 | 結果 | 🔴 | 🟡 | 🟢 |
|------|------|----|----|-----|
| Schema.org | PASS/FAIL | N | N | N |
| Meta Tags | PASS/FAIL | N | N | N |
| ... | ... | ... | ... | ... |

**整體評級**: [A/B/C/D/F]
**Verdict**: APPROVED / NEEDS_REVISION / REJECTED
```
