# GEO Content Optimization Template

> Generator Agent 的標準輸出結構。所有 GEO 內容優化產出必須嚴格遵循此模板。

---

## 1. Page Identity

| 欄位 | 值 |
|------|-----|
| **頁面路徑** | {{ PAGE_PATH }} |
| **核心主題** | {{ PRIMARY_TOPIC }} |
| **目標關鍵字** | {{ TARGET_KEYWORDS }} |
| **目標受眾** | {{ TARGET_AUDIENCE }} |
| **語言** | {{ LANGUAGE }} |

---

## 2. Meta Tags

```html
<title>{{ TITLE_TAG }}</title>
<meta name="description" content="{{ META_DESCRIPTION }}">
<link rel="canonical" href="{{ CANONICAL_URL }}">

<!-- Open Graph -->
<meta property="og:title" content="{{ OG_TITLE }}">
<meta property="og:description" content="{{ OG_DESCRIPTION }}">
<meta property="og:type" content="{{ OG_TYPE }}">
<meta property="og:url" content="{{ CANONICAL_URL }}">
<meta property="og:image" content="{{ OG_IMAGE_URL }}">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{{ OG_TITLE }}">
<meta name="twitter:description" content="{{ OG_DESCRIPTION }}">
```

### 規範
- Title Tag: 30-60 字元，含品牌名 `| TauX`
- Meta Description: 120-160 字元，含 CTA 動詞
- Canonical: 使用 clean URL（無 `.html` 後綴）

---

## 3. Schema.org Structured Data (JSON-LD)

```json
{
  "@context": "https://schema.org",
  "@type": "{{ SCHEMA_TYPE }}",
  "name": "{{ PAGE_TITLE }}",
  "description": "{{ META_DESCRIPTION }}",
  "url": "{{ CANONICAL_URL }}",
  "publisher": {
    "@type": "Organization",
    "name": "TauX 拓思科技",
    "url": "https://taux.io"
  }
  {{ ADDITIONAL_SCHEMA_FIELDS }}
}
```

### 常用 Schema Types
- 首頁 / 服務頁 → `WebPage` + `Organization`
- 技術指南 → `TechArticle`
- FAQ → `FAQPage`
- 操作指南 → `HowTo`

---

## 4. Heading Hierarchy

```
H1: {{ H1_TITLE }}（唯一，每頁只能有一個）
  H2: {{ SECTION_1_TITLE }}
    H3: {{ SUBSECTION_TITLE }}
  H2: {{ SECTION_2_TITLE }}
  H2: FAQ（如適用）
    H3: Q: {{ QUESTION_1 }}
    H3: Q: {{ QUESTION_2 }}
```

### 規範
- H1 必須唯一且包含核心關鍵字
- H2 作為主要段落分隔
- H3 以下用於細節展開
- 不可跳級（如 H1 直接到 H3）

---

## 5. Answer Container（答案容器）

> 答案容器是讓 AI 輕易解析的高密度內容格式。

### 格式要求
- 使用 **Q&A 格式** 直接回答用戶痛點
- 使用 **表格** 進行比較（如 GEO vs SEO）
- 使用 **列表** 展示步驟或特徵
- 段落控制在 3-5 句，每句傳達一個明確觀點
- 避免模糊用語（「可能」、「大概」→ 改用具體數據）

### FAQ Schema 範例
```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "{{ QUESTION }}",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "{{ ANSWER }}"
      }
    }
  ]
}
```

---

## 6. llms.txt Sync

確保 `static/llms.txt` 中包含此頁面的摘要段落：

```markdown
-   [{{ PAGE_TITLE }}](https://taux.io{{ PAGE_PATH }}): {{ ONE_LINE_DESCRIPTION }}
```

---

## 7. Internal Linking

| 連結文字 | 目標頁面 | 關係 |
|----------|----------|------|
| {{ ANCHOR_TEXT_1 }} | {{ TARGET_PATH_1 }} | {{ RELATION }} |
| {{ ANCHOR_TEXT_2 }} | {{ TARGET_PATH_2 }} | {{ RELATION }} |

### 規範
- 每頁至少 2 個內部連結
- 使用描述性 anchor text（非「點這裡」）
- 相關技術頁面互相連結

---

## 8. Notes & Deviations

{{ 記錄任何與標準模板不同的決策及原因 }}
