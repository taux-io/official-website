---
name: seo-geo-toolkit
description: SEO/GEO 優化的知識庫與模板集。提供結構化數據規範、審計清單、內容模板等資源，支援 SEO/GEO Agent 團隊按需載入。
---

# SEO/GEO Toolkit Skill

## 觸發條件
當使用者的請求包含以下關鍵字時，應載入此 Skill：
- `SEO`, `GEO`, `Schema`, `結構化數據`, `答案容器`
- `llms.txt`, `citation`, `搜尋優化`, `引用`
- `meta tags`, `sitemap`, `robots.txt`
- `FAQ Schema`, `JSON-LD`, `Open Graph`

## 資源目錄

### L1: 快速索引（總是可用）

| 資源 | 路徑 | 用途 |
|------|------|------|
| GEO 內容模板 | `assets/geo-content-template.md` | Generator Agent 的標準輸出結構 |
| SEO 審計清單 | `assets/seo-audit-checklist.md` | Reviewer Agent 的 10 項驗證框架 |
| Schema.org 速查 | `assets/schema-org-reference.md` | Tool Wrapper Agent 的參考知識 |

### L2: 按需載入（偵測到特定需求時）

根據關鍵字偵測，載入對應的 L1 資源：

| 偵測關鍵字 | 載入資源 |
|------------|----------|
| `"Schema"`, `"JSON-LD"`, `"結構化"` | `assets/schema-org-reference.md` |
| `"audit"`, `"審計"`, `"檢查"` | `assets/seo-audit-checklist.md` |
| `"optimize"`, `"優化"`, `"內容"` | `assets/geo-content-template.md` |

## 使用方式

1. **不要預載所有資源** — 僅載入當前任務需要的文件
2. **一次最多載入一個 L2 資源** — 保護 context window
3. **載入後提取相關段落** — 不要將整個文件倒入上下文

## 相關 Agents

此 Skill 供以下 Agent 使用：
- `agents/marketing/seo-geo-auditor.md` — 載入 Schema.org 規範進行審計
- `agents/marketing/geo-content-optimizer.md` — 載入模板進行內容生成
- `agents/marketing/seo-geo-reviewer.md` — 載入 checklist 進行品質驗證
