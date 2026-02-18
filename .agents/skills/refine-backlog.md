---
name: refine-backlog
description: 用於梳理產品待辦清單 (Backlog)，完善用戶故事細節，並生成驗收標準 (AC) 與 Story Point 估算建議。
---
Backlog Refinement Skill (GEO-Aware)

1. 目的
將模糊的單行需求轉化為 "Ready for Dev" 的詳細規格，特別關注 GEO (Generative Engine Optimization) 與 TauX 的 "Answer Container" 價值。

2. 執行步驟
需求解析：讀取原始需求（如 "用戶需要能導出報表"）。

角色化 (Actor Definition)：明確誰是使用者（Admin vs Lead/Subscriber）。

價值闡述 (Value Proposition)：
- "So that..." 部分必須明確業務價值與 GEO 關聯。
- 例如："...so that our content becomes more visible to AI search engines."

生成驗收標準 (Generate AC)：
撰寫至少 3 條驗收標準，涵蓋 Happy Path 與 Edge Cases。
包括 GEO 驗收：Meta tags, Schema.org 結構驗證。

技術依賴標註：詢問 `tech-lead` 是否需要特定 API 或 DB Schema 變更。

估算建議：根據需求的複雜度，建議 Story Points (Fibonacci: 1, 2, 3, 5, 8)。

3. 範例
Input: "Login page needs explicit error messages."
Output:
Story: As a user, I want to see clear error messages when login fails, so that I can correct my input and access the service quickly.
AC:
- Given I enter a wrong password, When I submit, Then show "Invalid credentials" (Ensure semantic HTML for accessibility).
- Given I leave fields empty, When I submit, Then show "Fields required".
