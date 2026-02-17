# Repository Guidelines for AI Agents

## 1. Project Overview & Stack
**TauX (拓思科技)** - AI for Smart Work & GEO.

- **Backend**: Go (Golang) 1.24+ with [Gin Web Framework](https://github.com/gin-gonic/gin).
- **Frontend**: Server-Side Rendered (SSR) HTML templates (`templates/*.html`) styled with **TailwindCSS v3.4**.
- **Containerization**: Docker & Docker Compose (Multi-stage build: Go builder -> Alpine runner).
- **Reverse Proxy**: Nginx (proxies to Go app).

## 2. Architecture & File Structure

### File Organization
- **`main.go`**: Application entry point. Configures Gin router, loads templates, serves static files.
- **`templates/`**: HTML files using Go templating syntax (`{{ template "header.html" . }}`).
  - Partials: `header.html`, `footer.html`.
  - Pages: `index.html`, `geo-guide.html`, `data-governance.html`, etc.
- **`src/`**: Source files for frontend build tools.
  - `input.css`: Main Tailwind CSS entry point (imports font, custom utilities).
- **`static/`**: Served publicly at `/static`.
  - `css/styles.min.css`: Compiled Tailwind output. **DO NOT EDIT DIRECTLY.**
  - `js/script.js`: Client-side logic (mobile menu, animations).
  - Images & Favicons.
- **`NOTES.md`**: **CRITICAL**. Contains project context, architectural decisions, and recent fixes. **Read this first.**

### Infrastructure
- **`Dockerfile`**: Multi-stage build. Uses `golang:1.24-alpine` for building and `alpine:latest` for running.
- **`docker-compose.yml`**: Orchestrates the `app` (Go) and `nginx` services.
- **`nginx.conf`**: Reverse proxy configuration.

## 3. Development Workflow

### Running Locally (Non-Docker)
1.  **Frontend (Watch Mode)**:
    ```bash
    npm run watch
    ```
    *Compiles `src/input.css` to `static/css/styles.min.css` on change.*

2.  **Backend (Hot Reload)**:
    ```bash
    go run main.go
    ```
    *Server runs on `http://localhost:8080`.*

### Running with Docker (Production-like)
```bash
docker compose up -d --build
```
*App runs behind Nginx on `http://localhost:80` (or configured port).*

## 4. Coding Standards & Conventions

### HTML & Templates
- Use Go templates for layout (`{{ define "content" }}`, `{{ template "header.html" }}`).
- **SEO**: Ensure `meta` tags (Title, Description, OG) are present in `header.html` or overridden in pages.
- **Structure**: Semantic HTML5 (`main`, `section`, `article`, `nav`).

### CSS & Styling (TailwindCSS)
- **Primary Method**: Use Tailwind utility classes directly in HTML.
- **Custom Styles**: Add to `src/input.css` using `@layer components` or `@layer utilities` only if necessary.
- **Design Token**:
  - Background: `bg-taux-bg` (#030305)
  - Accents: `text-tech-cyan` (#00F0FF), `text-tech-purple` (#7000FF).
- **Dark Mode**: Enabled by default (`class="dark"` in `html`).

### JavaScript
- Vanilla JS only (no React/Vue/jQuery).
- Keep logic in `static/js/script.js`.
- Use `document.addEventListener('DOMContentLoaded', ...)` for initialization.

## 5. Critical Context & Known Issues
*Refer to `NOTES.md` for the most up-to-date list.*

- **Mobile Menu**: The overlay MUST have `z-index: 9999 !important` and a solid background to cover page content. See `templates/header.html`.
- **Go Version**: Strictly requires Go 1.24+.
- **CSS Build**: If styles look wrong, ensure `npm run build` or `npm run watch` successfully updated `static/css/styles.min.css`.
