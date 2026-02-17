---
name: TauX 開發技能
description: TauX 網站開發、測試與部署的通用工作流程。
---

# TauX Developer Skills & Procedures (SKILL.md)

This document provides specific **"How-to"** procedures and checklists required by `AGENTS.md`.

## 1. Environment & Execution

### Local Development (Fast Loop)
-   **Backend**: `go run main.go` (http://localhost:8080)
-   **Frontend**: `npm run watch` (Watches `src/input.css` -> `static/css/styles.min.css`)

### Production Simulation (Docker)
-   **Command**: `docker compose up -d --build`
-   **URL**: `http://localhost` (via Nginx)
-   **Logs**: `docker compose logs -f`
-   **Note**: Always use `--build` if `go.mod` or dependencies change.

## 2. Standard Procedures (SOPs)

### A. Creating a New Page
1.  **Template**: Copy an existing file (e.g., `templates/index.html`) to `templates/new-page.html`.
2.  **Route**: Register GET route in `main.go`.
    ```go
    r.GET("/new-page", func(c *gin.Context) {
        c.HTML(http.StatusOK, "new-page.html", nil)
    })
    ```
3.  **Navigation**: Update `templates/header.html` (Desktop & Mobile) and `templates/footer.html`.

### B. Styling with Tailwind
-   **Primary**: Use utility classes directly in HTML (e.g., `text-tech-cyan`, `bg-taux-bg`).
-   **Custom CSS**: Only add to `src/input.css` if reusing a complex component (e.g., `.glass-card`).
-   **Rebuild**: Ensure `npm run build:css` runs if styles don't appear.

### C. Mobile Menu Fixes
-   **Issue**: Menu overlay not covering content.
-   **Fix**: Ensure `z-index: 9999` and `opacity: 1` are set inline or via utility classes on the overlay container.
-   **Reference**: See `templates/header.html` structure.

## 3. QA & Verification Checklist
*Required for "Verification" phase in `AGENTS.md` workflow loop.*

### A. Technical Verification
- [ ] **HTML Structure**: No unclosed tags; unique IDs.
- [ ] **Mobile Responsiveness**:
    - [ ] Hamburger menu opens/closes smoothly.
    - [ ] Overlay covers **entire** screen (no leakage).
    - [ ] No horizontal scrolling (overflow-x hidden).
- [ ] **Console**: Zero errors in DevTools.
- [ ] **Links**: All internal/external links work (No 404s).

### B. GEO & SEO Verification
- [ ] **Meta Tags**: Unique `title` and `description` per page.
- [ ] **Structured Data**: Valid JSON-LD (Organization, FAQPage, etc.).
- [ ] **Semantics**: Correct logical heading hierarchy (`h1` -> `h2`).

### C. Visual Verification ("Simple & Clean Tech")
- [ ] **Palette**: Only Monochrome + Cyan (`#00F0FF`). No random colors.
- [ ] **Legibility**: Text clearly readable on dark backgrounds.
- [ ] **Consistency**: Icons and buttons match the design system.
