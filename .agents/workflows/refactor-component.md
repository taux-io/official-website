---
description: 將現有程式碼重構，以提升效能、可讀性或遵循設計規範。
---
# Component Refactoring Skill

## 1. 目的
重構現有的 HTML 或 CSS，提升程式碼品質與維護性，同時保持視覺一致性與不破壞現有功能。

## 2. 執行規範

**分析現況 (Analyze)**: 
閱讀現存的程式碼與 DOM 結構，確保理解與其他元件的聯動情形。
避免移除正在被 JS 或其它樣式參考的 ID 或 Class。

**改寫與清理 (Rewrite & Cleanup)**:
移除重複或不必要的 Utility Classes。
將冗長或重複利用的樣式抽象至 `src/input.css` 中（例如通用的 `.btn` 或 `.glass-panel`），但以盡量少寫 Custom CSS 為原則。

**無障礙 (A11y)**:
確保按鈕具備 `aria-label`。
確保對比度符合標準 (`text-gray-300` 等深色底上文字的選擇)。

**功能與樣式不變前提下 (Behavior Preserving)**:
保證經過重構後，視覺外觀與原先一致（像素級審視）。

## 3. 輸出要求
修改前與修改後的差異對比（如果是獨立元件，請提供 HTML 結構，若需 CSS 變更請提供對應的 Tailwind Classes 或 input.css 更新）。
解釋重構的原因及帶來的好處。
