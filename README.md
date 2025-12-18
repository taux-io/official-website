# TauX 拓思科技有限公司 - 官方網站 (Go 版本)

這是 TauX 拓思科技有限公司的官方網站，使用 Go、Gin 和 Tailwind CSS 重新構建。

## 目錄

- [🚀 環境建置](#-環境建置)
  - [先決條件](#先決條件)
- [🚢 正式環境部署](#-正式環境部署)
- [🛠️ 本地開發](#️-本地開發)
  - [Docker 開發環境 (建議)](#docker-開發環境-建議)
  - [手動設置](#手動設置)
- [🔬 技術棧](#-技術棧)
- [📁 專案結構](#-專案結構)
- [📜 可用指令](#-可用指令)

## 🚀 環境建置

### 先決條件

在開始之前，請確保您已安裝以下工具：

- [Docker](https://www.docker.com/get-started)
- [Docker Compose](https://docs.docker.com/compose/install/)
- [Go](https://golang.org/dl/) (版本 1.24 或更高)
- [Node.js](https://nodejs.org/en/download/) (版本 18 或更高)
- [mise](https://mise.jdx.dev/getting-started.html) (建議使用)
- [air](https://github.com/air-verse/air) (用於 Go 熱重載)
- [golangci-lint](https://golangci-lint.run/usage/install/) (用於 Go Linter)

**macOS 使用 Homebrew 和 mise 的設定:**

1.  **安裝 Go:**
    ```bash
    mise use --global go@latest
    ```

2.  **在 `.zshrc` 中設定環境變數:**
    ```bash
    export GOPATH=$HOME/go
    export PATH=$PATH:$GOPATH/bin
    ```

3.  **安裝 `air` 用於熱重載:**
    ```bash
    go install github.com/air-verse/air@latest
    ```

4.  **安裝 `golangci-lint`:**
    ```bash
    brew install golangci-lint
    ```

## 🚢 正式環境部署

此專案使用 Docker 進行容器化，方便部署。

1.  **Clone 儲存庫:**
    ```bash
    git clone https://github.com/taux-io/official-website.git
    cd official-website
    ```

2.  **建置並執行應用程式:**
    ```bash
    docker-compose up -d --build
    ```

3.  **開啟您的瀏覽器並前往:**
    [http://localhost:8080](http://localhost:8080)

## 🛠️ 本地開發

### Docker 開發環境 (建議)

我們強烈建議使用 Docker 進行本地開發，以確保環境一致性。

1.  **建置並執行開發容器:**
    ```bash
    docker-compose -f docker-compose.dev.yml up -d --build
    ```

2.  **應用程式將在以下位置提供:**
    [http://localhost:8080](http://localhost:8080)

    當您對原始碼進行變更時，伺服器將自動重新啟動。

### 手動設置

如果您偏好在本地直接執行應用程式，請按照以下步驟操作：

1.  **安裝 Go 和 Node.js 相依套件:**
    ```bash
    go mod tidy
    npm install
    ```

2.  **啟動後端 (使用 air 進行熱重載):**
    ```bash
    air -c .air.toml
    ```

3.  **編譯 CSS (使用 watch 模式):**
    在另一個終端機中執行：
    ```bash
    npm run build:css -- --watch
    ```

4.  **開啟您的瀏覽器並前往:**
    [http://localhost:8080](http://localhost:8080)

## 🔬 技術棧

- **後端:** Go, Gin
- **前端:** Tailwind CSS, PostCSS
- **容器化:** Docker, Docker Compose
- **反向代理:** Nginx
- **開發工具:** air, golangci-lint, mise

## 📁 專案結構

```
.
├── .air.toml
├── Dockerfile
├── Dockerfile.dev
├── docker-compose.yml
├── docker-compose.dev.yml
├── go.mod
├── go.sum
├── main.go
├── nginx.conf
├── package.json
├── postcss.config.js
├── static/
│   ├── css/
│   ├── js/
│   └── ... (圖片, 字體等)
├── tailwind.config.js
└── templates/
    └── index.html
```

## 📜 可用指令

| 指令 | 描述 |
| --- | --- |
| `npm run build:css` | 編譯 Tailwind CSS |
| `go run main.go` | 執行 Go 應用程式 |
| `air -c .air.toml` | 使用 air 執行應用程式 (熱重載) |
| `golangci-lint run` | 執行 Go linter |
| `docker-compose up -d` | 啟動正式環境容器 |
| `docker-compose down` | 停止正式環境容器 |
| `docker-compose -f docker-compose.dev.yml up -d` | 啟動開發環境容器 |
| `docker-compose -f docker-compose.dev.yml down` | 停止開發環境容器 |
