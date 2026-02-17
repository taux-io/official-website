# TauX Project Notes & Context Memory

## Project Overview
TauX (拓思科技) is a "GEO of Things" technology company focusing on AI-driven smart work solutions, data governance, and Generative Engine Optimization (GEO).

## Architecture
- **Backend**: Go (Golang) 1.24+ using Gin framework.
- **Frontend**: Server-Side Rendered (SSR) HTML templates with TailwindCSS v3.4.
- **Infrastructure**: Dockerized environment with Nginx as a reverse proxy.
- **Design System**: "Premium Tech" aesthetic (Deep Void Black `#030305`, Neon Cyan `#00F0FF`, Purple `#7000FF`).

## Key Decisions & Conventions
- **Template Structure**: `templates/` folder contains HTML. `header.html` and `footer.html` are partials.
- **Static Files**: Served from `/static`. CSS is built from `src/input.css` to `static/css/styles.min.css`.
- **Docker Build**: Multi-stage build (Golang builder -> Alpine runner).
- **Tailwind**: Used for all styling. Configured in `tailwind.config.js`. Dark mode is class-based but default is dark.

## Common Issues & Fixes
- **Mobile Menu Transparency**: The glassmorphism effect (`backdrop-blur`) caused readability issues on mobile. Fixed by enforcing a solid background color (`#030305`) with `!important` on the mobile menu overlay in `header.html`.
- **Background Image**: Initially missing due to build issues. Fixed by ensuring `styles.min.css` is correctly built and loaded, and using a solid background color backup in `header.html`.
- **Go Version**: `go.mod` requires Go 1.24. Ensure Dockerfile uses `golang:1.24-alpine`.

## Commands
- **Dev**: `go run main.go` (backend), `npm run watch` (css).
- **Prod**: `docker compose up -d --build`.

## Recent Updates
- Refactored entire site from Python/Static to Go/Gin.
- Implemented full "Tech Mode" redesign with Tailwind.
- Added "LLMs.txt" and "Prompt Injection" pages.
- Verified mobile responsiveness and Docker deployment.
