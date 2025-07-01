# TauX 拓思科技有限公司 - 官方網站

![TauX Logo](src/taux-logo-light.png)

**Code the Future - 用科技創造未來**

TauX 拓思科技有限公司專注於軟體平台開發與短影片行銷整合，運用 AI 技術為企業打造全方位數位轉型解決方案。

## 🚀 關於我們

我們是高雄在地的專業團隊，致力於為台灣企業提供最優質的數位化服務。結合軟體開發專業與創意行銷策略，為您的品牌創造數位時代的競爭優勢。

### 🎯 核心服務

- **💻 軟體平台開發** - 企業級 Web 應用、APP、SaaS 平台開發
- **🎬 短影片製作與策略** - TikTok、Instagram Reels、YouTube Shorts 內容製作
- **📈 數位行銷整合** - 社群媒體經營、SEO、廣告投放策略
- **🤖 AI 智能解決方案** - 智能客服、數據分析、自動化工具
- **⚙️ 系統整合與自動化** - CRM/ERP 系統串接、工作流程優化

## 🛠️ 技術規格

本專案使用現代化的前端技術架構：

- **HTML5** - 語義化標記與 SEO 優化
- **CSS3** - 響應式設計與深色模式支援
- **JavaScript** - 互動功能與主題切換
- **Docker** - 容器化部署
- **live-server** - 開發環境熱重載

## 📁 專案結構

```
taux-dev/
├── README.md                    # 專案說明文件
├── Dockerfile                   # Docker 容器配置
├── docker-compose.yml           # Docker Compose 配置
└── src/                        # 網站原始碼
    ├── index.html              # 主頁面
    ├── styles.css              # 樣式表
    ├── robots.txt              # 搜尋引擎爬蟲規則
    ├── sitemap.xml             # 網站地圖
    ├── site.webmanifest        # PWA 配置
    ├── taux-logo-light.png     # 淺色主題 Logo
    ├── taux-logo-dark.png      # 深色主題 Logo
    ├── rocket.png              # 火箭圖示
    └── favicons/               # 網站圖標
        ├── favicon.ico
        ├── favicon-16x16.png
        ├── favicon-32x32.png
        ├── apple-touch-icon.png
        ├── android-chrome-192x192.png
        └── android-chrome-512x512.png
```

## 🚀 快速開始

### 方法一：使用 Docker（推薦）

```bash
# 複製專案
git clone <repository-url>
cd taux-dev

# 使用 Docker Compose 啟動
docker-compose up -d

# 訪問網站
open http://localhost:8080
```

### 方法二：本地開發

```bash
# 安裝 live-server
npm install -g live-server

# 啟動開發伺服器
live-server src --port=8080 --host=0.0.0.0

# 訪問網站
open http://localhost:8080
```

## 🎨 功能特色

### 📱 響應式設計
- 自適應各種螢幕尺寸
- 移動裝置優先設計
- 觸控友好的使用者介面

### 🌙 深色模式支援
- 自動偵測系統主題偏好
- 平滑的主題切換動畫
- 響應式 Logo 自動切換

### 🔍 SEO 優化
- 完整的 Meta 標籤配置
- 結構化數據 (Schema.org)
- 多語言支援 (zh-TW, en)
- 社群媒體優化 (Open Graph, Twitter Cards)

### ⚡ 效能優化
- 圖片延遲載入
- 字體預加載
- CSS/JS 最佳化
- 快取策略

## 🔧 開發指南

### 編輯內容
主要內容位於 `src/index.html`，使用語義化的 HTML5 標記：

```html
<!-- 服務區塊 -->
<section class="services-section" id="services">
    <h3 class="service-title">💻 軟體平台開發</h3>
    <p class="service-description">專業開發企業級軟體平台...</p>
</section>
```

### 樣式自訂
CSS 樣式位於 `src/styles.css`，支援 CSS 變數和深色模式：

```css
/* 深色模式變數 */
@media (prefers-color-scheme: dark) {
    :root {
        --bg-color: #1a1a1a;
        --text-color: #e0e0e0;
    }
}
```

### 新增頁面
1. 在 `src/` 目錄下創建新的 HTML 檔案
2. 更新導航選單 (`main-navigation`)
3. 添加對應的 CSS 樣式
4. 更新 `sitemap.xml`

## 📊 SEO 與分析

### 結構化數據
網站包含完整的 Schema.org 結構化數據：
- Organization (組織資訊)
- LocalBusiness (本地商家)
- FAQPage (常見問題)
- BreadcrumbList (麵包屑導航)

### 社群媒體整合
- Open Graph 標籤 (Facebook)
- Twitter Cards 標籤
- 社群分享優化圖片

## 🚀 部署說明

### 使用 Docker 部署
```bash
# 建構映像
docker build -t taux-website .

# 執行容器
docker run -d -p 8080:8080 taux-website
```

### 靜態網站部署
將 `src/` 目錄內容部署至任何靜態網站託管服務：
- Netlify
- Vercel
- GitHub Pages
- Firebase Hosting

## 📞 聯絡資訊

- **公司名稱**: TauX 拓思科技有限公司
- **網站**: https://taux.io
- **電子郵件**: hello@taux.io
- **電話**: 07-6211033
- **地址**: 高雄市岡山區文賢路 57 號 2 樓

## 📝 授權條款

© 2025 TauX 拓思科技有限公司. 保留所有權利.

---

**Code the Future - 用科技創造未來** 🚀