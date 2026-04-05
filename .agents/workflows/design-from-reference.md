---
description: 使用 awesome-design-md 的 DESIGN.md 設計規範，從參考設計到生成 UI 組件的完整工作流程。
---
# Design from Reference Workflow

根據已登錄的品牌設計系統（DESIGN.md），經過完整的 5 階段 Pipeline 產出符合設計規範的 UI 組件。

## 前提條件
- 確保 `skills/design-system-library/` 已正確建置
- 確認目標品牌的 `DESIGN.md` 存在於 `references/` 中

## 執行步驟

### Phase 1: 需求訪談 (Inversion)
1. 閱讀 `agents/design/design-interviewer.md` 的指引
2. 使用 `assets/design-brief-questions.md` 訪談使用者
3. 必須收集：設計系統選擇、組件類型、斷點需求
4. 產出完整的 **Design Brief** 文件
5. ◆ **Gate**: 使用者確認 Design Brief

### Phase 2: 設計標記載入 (Tool Wrapper)
// turbo
6. 閱讀 `agents/design/design-system-expert.md` 的指引
7. 根據 Design Brief 中的品牌 ID，載入對應的 `references/<brand>.md`
8. 萃取當前組件所需的設計標記（顏色、字體、陰影、間距）
9. ◆ **Gate**: 確認正確的 DESIGN.md 已載入且標記已萃取

### Phase 3: 組件生成 (Generator)
10. 閱讀 `agents/design/ui-component-generator.md` 的指引
11. 使用 `assets/component-spec-template.md` 作為輸出模板
12. 填入所有 `{{ PLACEHOLDER }}` 欄位
13. 產出語意化 HTML + Tailwind CSS 對應
14. ◆ **Gate**: 模板所有欄位已填寫，HTML 結構有效

### Phase 4: 設計審查 (Reviewer)
15. 閱讀 `agents/design/design-reviewer.md` 的指引
16. 使用 `assets/design-audit-checklist.md` 執行 8 項稽核
17. 產出嚴重性分級的稽核報告
18. ◆ **Gate**: 零 🔴 Critical 發現。若有 Critical → 回到 Phase 3 修正（最多 3 次）

### Phase 5: 整合 (Pipeline)
19. 將組件 HTML 放入 `templates/` 目錄，使用 Go template partial 語法
// turbo
20. 執行 `npm run build:css` 重建樣式
21. 透過瀏覽器確認渲染正確
22. 更新 `NOTES.md` 記錄重大設計決策
23. ◆ **Gate**: 組件在瀏覽器中無錯誤渲染

## 輸出成果
- 經稽核通過的組件規格文件（依 `component-spec-template.md` 格式）
- 可直接使用的 HTML Template Partial
- 設計稽核報告
