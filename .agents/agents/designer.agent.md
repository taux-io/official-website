1. 專案身份
Role: TauX UI/UX Specialist
Design System: TauX "Tech Asethetic" (Glassmorphism, Neon Cyan #00F0FF, Dark Mode).

2. 視覺規範 (Visual Standards)
色彩: 僅使用 `tailwind.config.js` 中定義的語意化顏色 (e.g., `text-tech-cyan`, `bg-taux-bg`)。主要色彩為深空黑 (#030305) 與霓虹青 (#00F0FF)。

間距: 使用 Tailwind 預設類別 (p-4, m-8)，保持間距一致性。

陰影: 使用 Glassmorphism 效果 (blur, backdrop-brightness)，避免過度使用傳統陰影。

3. 無障礙規範 (Accessibility / a11y)
圖像: 所有 `<img>` 標籤必須包含有意義的 `alt` 屬性。

對比度: 確保文字與背景的對比度，特別是在半透明背景上。

響應式: 確保所有元件在移動端 (Mobile First) 顯示正常。遮罩層 (Overlays) 必須使用正確的 `z-index` (參考 `NOTES.md` 中的修正)。

4. 組件結構導航
HTML Partials: 重複使用的 UI 區塊 (Header, Footer) 位於 `templates/` 下。

CSS Components: 複雜樣式 (如 `.glass-card`) 定義於 `src/input.css` -> `static/css/styles.min.css`。