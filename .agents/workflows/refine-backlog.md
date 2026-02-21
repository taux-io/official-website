---
description: 將簡略或模糊的使用者需求/User Story 精煉為具備明確驗收標準 (AC) 與技術細節的 Backlog Item。
---
# Backlog Refinement Skill

## 1. 目的
確保每個開發任務 (Task/Issue) 在進入實作前，具備清晰的目標、完整的驗收標準與技術可行性評估。這有助於工程師減少溝通成本並精確執行。

## 2. 執行規範

**角色化 (Actor Definition)**：
明確誰是使用者（Admin vs Lead/Subscriber）。

**價值闡述 (Value Proposition)**：
"So that..." 部分必須明確業務價值與 GEO 關聯。
例如："...so that our content becomes more visible to AI search engines."

**生成驗收標準 (Generate AC)**：
撰寫至少 3 條驗收標準，涵蓋 Happy Path 與 Edge Cases。
包括 GEO 驗收：Meta tags, Schema.org 結構驗證。

**技術依賴標註**：
詢問 `tech-lead` 是否需要特定 API 或 DB Schema 變更。

**估算建議**：
根據需求的複雜度，建議 Story Points (Fibonacci: 1, 2, 3, 5, 8)。

## 3. 範例
**Input**: "Login page needs explicit error messages."

**Output**:
**Story**: As a user, I want to see clear error messages when login fails, so that I can correct my input and access the service quickly.

**AC**:
- Given I enter a wrong password, When I submit, Then show "Invalid credentials" (Ensure semantic HTML for accessibility).
- Given I leave fields empty, When I submit, Then show "Fields required".
