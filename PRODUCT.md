# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **中小企業的老闆與主管**：決策者，評估要不要找外部顧問導入 AI、做廣告與搜尋優化、辦教育訓練或強化資安。多半已經有同仁各自在用 AI 工具，但公司沒有共同做法，也說不出成效。
- **政府機關**：主要是 Google Workspace 教育訓練的採購與承辦單位。
- 兩者的共同處境：想做，但不確定從哪裡開始、該花多少、怎麼知道有沒有效。

## Product Purpose

taux.io 是拓思科技股份有限公司（TauX）的官網，讓第一次來的訪客在短時間內知道三件事：TauX 做什麼、適不適合我、怎麼開始。成功的樣子是訪客讀完服務頁後寫信來談合作（目前唯一的聯絡管道是 hello@taux.io）。

服務分四類十項，對象是中小企業（Workspace 課程也服務政府機關）：
- AI 導入與整合：企業 AI 導入顧問、舊系統與 AI 串接（MCP）、AI Agent 開發、資料治理
- 行銷：數位廣告投放（Google、Meta）、SEO 與 GEO 搜尋優化
- 教育訓練：Google Workspace 教育訓練、生成式 AI 實務課程
- 資安：AI 對抗測試、Google SecOps 導入

## Positioning

- **顧問加技術導入一起做**：不只給建議，也實際開發與串接（MCP server、AI Agent、SecOps 導入）。
- **先量基線，再動工**：導入前記錄現況數字，結束時用同一把尺驗收。
- **公開的技術作品**：公開維護 TWSE MCP（臺灣證交所公開資料的 MCP server），技術文章每篇附出處並寫明結論的適用範圍。
- **在地且多語**：公司在高雄岡山，網站與服務內容支援繁中、簡中、日、韓、英。

## Operating Context

- 合作以三個月、半年或一年為一個週期，依範圍決定；每個週期結束時對照目標，決定下一步或到此為止。
- 計價依個別案例估算，網站不列價格。
- 訪客可能從搜尋引擎、AI 回答工具（網站提供 llms.txt 與每頁 Markdown 版本）或社群分享卡進站；技術文章是主要的進站點之一，文章結尾連回對應服務。

## Capabilities and Constraints

- 靜態網站：Rust 產生器依 `site.toml` 產生五種語言、140 頁，部署在 Cloudflare Workers；合併到 main 即上線。
- 五種語言：zh-Hant-TW（正本）、zh-Hans-CN、ja-JP、ko-KR、en-US。
- 37 條自動設計檢查與四道瀏覽器稽核（對比含高對比模式、路由規格、版面、分享卡），規則寫在 DESIGN.md。
- 聯絡管道只有 email；電話、LINE、線上預約尚未決定，不可自行新增。
- `/building`（公開開發日誌）尚未有內容，目前 noindex 且不在選單。

## Brand Commitments

- 公司名稱：TauX 拓思科技（法定名稱：拓思科技股份有限公司）。名字源自希臘字母 τ——時間常數，「縮短導入 AI 的時間常數」是品牌故事。
- 品牌句「AI that earns its place」在所有語言保留英文（對外口徑一致）。
- 語氣：冷靜、具體、不促銷；不寫認證、合作夥伴資格、案例或價格等沒有依據的主張。
- 標誌：τX logo（原檔 `brand-src/TauX-black.svg`、`brand-src/TauX-white.svg`）。
- 視覺上不使用實際照片（擁有者指定）；插圖與吉祥物小機器人為扁平 SVG。

## Evidence on Hand

- 公開的 TWSE MCP 開源專案：https://github.com/taux-io/twse-mcp
- 12 篇技術文章（`/insights`）。
- **沒有**：客戶案例、客戶名單、推薦語、認證或合作夥伴資格、團隊照片（擁有者表示之後會提供）。這些都不可捏造或暗示。

## Product Principles

1. 先說清楚賣什麼、給誰、怎麼開始，再談其他。
2. 每一句主張都要站得住：只寫做得到、查得到的事。
3. 用讀者的語言說話：在地語言優先，五種語言內容一致。
4. 找得到、聯絡得到：每一頁都能走到服務與聯絡方式。

## Accessibility & Inclusion

- WCAG AA 對比，並在 Windows 高對比模式下檢查；觸控目標 44px；hover 只在支援的裝置上生效；尊重「減少動態效果」。
- 所有路由在手機（375×812）第一屏要看得到第一段正文。
