# Schema.org 常用類型速查表

> Tool Wrapper Agent 的參考知識庫。按需載入，不要一次全部載入。

---

## WebPage（通用網頁）

適用：首頁、服務頁、Building 頁面

```json
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "頁面標題",
  "description": "頁面描述",
  "url": "https://taux.io/path",
  "publisher": {
    "@type": "Organization",
    "name": "TauX 拓思科技",
    "url": "https://taux.io",
    "email": "hello@taux.io"
  }
}
```

---

## Organization（公司資訊）

適用：首頁、About 頁

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "TauX 拓思科技",
  "url": "https://taux.io",
  "email": "hello@taux.io",
  "telephone": "+886-7-6211033",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "高雄市岡山區文賢路 57 號 2 樓",
    "addressLocality": "高雄市",
    "addressRegion": "台灣",
    "postalCode": "820"
  },
  "description": "TauX 是一家協助企業 AI First 落地與技術開發服務的公司。",
  "sameAs": [
    "https://github.com/taux-io"
  ]
}
```

---

## TechArticle（技術文章）

適用：GEO Guide, Prompt Guide, Skills Guide, ADK Patterns

```json
{
  "@context": "https://schema.org",
  "@type": "TechArticle",
  "headline": "文章標題",
  "description": "文章描述",
  "url": "https://taux.io/path",
  "author": {
    "@type": "Organization",
    "name": "TauX 拓思科技"
  },
  "publisher": {
    "@type": "Organization",
    "name": "TauX 拓思科技",
    "url": "https://taux.io"
  },
  "datePublished": "2026-01-01",
  "dateModified": "2026-04-06",
  "proficiencyLevel": "Beginner|Intermediate|Expert",
  "dependencies": "相關技術依賴描述",
  "inLanguage": "zh-Hant"
}
```

---

## FAQPage（常見問題）

適用：任何包含 FAQ 區塊的頁面

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "問題文字",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "答案文字（純文字，不含 HTML）"
      }
    }
  ]
}
```

### 注意事項
- `name` 應為自然語言問句
- `text` 應為純文字（Google 建議不含 HTML）
- 每個 FAQ 獨立成一個 Question 物件
- 可與 `WebPage` 或 `TechArticle` 並存（使用 `@graph`）

---

## HowTo（操作指南）

適用：步驟式教學頁面

```json
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "指南標題",
  "description": "指南描述",
  "step": [
    {
      "@type": "HowToStep",
      "name": "步驟名稱",
      "text": "步驟詳細描述",
      "position": 1
    }
  ],
  "totalTime": "PT30M"
}
```

---

## 複合使用（@graph）

當一個頁面需要多個 Schema 類型時：

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "TechArticle",
      "headline": "...",
      "url": "..."
    },
    {
      "@type": "FAQPage",
      "mainEntity": [...]
    }
  ]
}
```

---

## TauX 專屬欄位一致性

以下欄位在所有 Schema 中必須一致：

| 欄位 | 固定值 |
|------|--------|
| Organization name | `TauX 拓思科技` |
| Organization url | `https://taux.io` |
| email | `hello@taux.io` |
| telephone | `+886-7-6211033` |
| address | `高雄市岡山區文賢路 57 號 2 樓` |
