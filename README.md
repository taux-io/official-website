# TauX 拓思科技有限公司 - Official Website (Go Edition)

This is the official website for TauX 拓思科技有限公司, rebuilt with Go, Gin, and Tailwind CSS.

## 🚀 Getting Started

### Prerequisites

- Docker
- Docker Compose

### Running the application

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/taux-io/official-website.git
    cd official-website
    ```

2.  **Build and run the application:**
    ```bash
    docker-compose up -d --build
    ```

3.  **Open your browser and navigate to:**
    [http://localhost:8080](http://localhost:8080)

## 🛠️ Development

### macOS Setup with Homebrew and mise

1.  **Install Go:**
    ```bash
    mise use --global go@latest
    ```

2.  **Set up environment variables in `.zshrc`:**
    ```bash
    export GOPATH=$HOME/go
    export PATH=$PATH:$GOPATH/bin
    ```

3.  **Install `air` for live reloading:**
    ```bash
    go install github.com/air-verse/air@latest
    ```

4.  **Install `golangci-lint`:**
    ```bash
    brew install golangci-lint
    ```

### Docker-based Development

1.  **Build and run the development container:**
    ```bash
    docker-compose -f docker-compose.dev.yml up -d --build
    ```

2.  **The application will be available at:**
    [http://localhost:8080](http://localhost:8080)

    The server will automatically restart when you make changes to the source code.

## 🔬 Tech Stack

- **Backend:** Go, Gin
- **Frontend:** Tailwind CSS
- **Containerization:** Docker, Docker Compose
- **Reverse Proxy:** Nginx
- **Development:** air, golangci-lint

## 📁 Project Structure

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
│   └── ... (images, fonts, etc.)
├── tailwind.config.js
└── templates/
    └── index.html
```
