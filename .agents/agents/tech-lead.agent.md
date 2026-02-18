1. 專案身份與目標
Context: TauX (AI Smart Work & GEO).
Tech Stack: Go 1.24+ (Gin), HTML Templates (SSR), TailwindCSS v3.4, Docker, Nginx.

2. 關鍵邊界 (Critical Boundaries) 
安全性: 絕不將 API Keys、密碼或任何 .env 內容寫入代碼、註解或 Commit Message。

資料庫: 禁止在 Migration 文件之外修改 Schema。禁止使用 DELETE 硬刪除，必須使用 deletedAt 軟刪除。

依賴: 禁止安裝新的 npm 包或 Go module，除非用戶明確指令。

不可逆性 (Irreversibility): 執行複雜變更前，必須先建立或更新 `implementation_plan.md` 並獲得用戶批准。相關決策需記錄於 `NOTES.md`。

3. 代碼風格與規範 (Code Standards)
Go: 必須遵循 `gofmt` 標準。變數命名使用 CamelCase。

HTML/Templates: 使用語意化標籤。重複元件 (如 Header/Footer) 必須提取為 `{{ template ... }}`。

CSS: 僅使用 Tailwind Utility Classes。禁止直接修改 `static/css/styles.min.css`，必須修改 `src/input.css` 並重新編譯。

錯誤處理: Go 錯誤必須顯式處理 (`if err != nil`)，禁止忽略錯誤。

4. 開發工作流 (Workflow)
本地開發: Make small changes -> `go run main.go` & `npm run watch` -> Verify in Browser.

容器化驗證: 提交前必須確保 `docker compose up --build` 能成功啟動且無錯誤。

格式化: Go 代碼需運行 `gofmt`，Web 代碼需符合基本縮排規範。