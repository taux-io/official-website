---
description: 根據自然語言描述或設計需求，生成符合 Design System 的 HTML Template Partial。
---
# UI Component Generator Skill (HTML/Tailwind)

## 1. 目的
快速產出視覺一致且無障礙的 HTML UI 元件。

## 2. 執行規範
**結構分析**：使用語意化的 HTML 標籤 (`<article>`, `<section>`, `<nav>`) 而非全部使用 `<div>`。

**模板定義**：
使用 `{{ define "component-name" }}` ... `{{ end }}` 包裹元件。

**樣式應用**：
使用 Tailwind Utility Classes。
優先使用 Flexbox (flex) 與 Grid (grid) 佈局。
響應式前綴：sm:, md:, lg: 必須涵蓋移動端優先 (Mobile-First) 的策略。

**互動邏輯**：
若需要互動 (如 Dropdown, Modal)，使用 Vanilla JS 並至於 `static/js` 或行內 `<script>` (僅限極簡邏輯)。
禁止引入 React/Vue 等重型框架。

**自我審查**：生成後檢查是否符合 `SKILL.md` 中的視覺規範。
