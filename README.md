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

## 🛠️ Tech Stack

- **Backend:** Go, Gin
- **Frontend:** Tailwind CSS
- **Containerization:** Docker, Docker Compose
- **Reverse Proxy:** Nginx

## 📁 Project Structure

```
.
├── Dockerfile
├── docker-compose.yml
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
