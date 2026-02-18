name: refactor-component
description: 用於重構現有 Go Template Partials 或 Handler 函數，提升可讀性、降低複雜度與優化效能。

Component Refactoring Skill (Go/Templates)
1. 目的
對遺留代碼進行現代化重構，確保符合當前的 Clean Code 標準 (Go Standard Library & HTML Templates)。

2. 執行步驟
靜態分析：檢查 `main.go` 中的 Handler 函數是否過長 (> 50 行)。若過長，則必須拆分。

模板重構：
將重複的 HTML 區塊提取為 `templates/partials/` 下的獨立檔案。
使用 `{{ template "name" . }}` 引用。

樣式提取：
將內聯樣式 (Inline Styles) 提取為 Tailwind 類別。
對於複雜且重複使用的樣式，提取至 `src/input.css` 並定義為 `@apply` rules。

錯誤處理優化：確保所有 `err` 都被正確處理，而不是被忽略 (`_`)。

回歸驗證：重構後運行 `go test` (如果有) 或手動驗證頁面功能與樣式一致性。