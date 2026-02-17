---
name: TauX Development Skills
description: Common workflows for developing, testing, and deploying the TauX website.
---

# TauX Development Skills

This document defines standard operating procedures (SOPs) for AI agents working on this repository.

## 1. Environment Setup & Execution

### Local Development (Fast)
- **Backend**: `go run main.go`
  - Runs on: `http://localhost:8080`
- **Frontend**: `npm run watch`
  - Watches `src/input.css` and rebuilds to `static/css/styles.min.css`.

### Production Simulation (Docker)
- **Command**: `docker compose up -d --build`
- **Url**: `http://localhost` (via Nginx on port 80)
- **Logs**: `docker compose logs -f`
- **Rebuild**: If you change `go.mod` or dependencies, always include `--build`.

## 2. Standard Tasks

### Adding a New Page
1.  **Create Template**: Copy `templates/index.html` or another existing page to `templates/new-page.html`.
2.  **Add Route**: In `main.go`, add a new GET route:
    ```go
    r.GET("/new-page", func(c *gin.Context) {
        c.HTML(http.StatusOK, "new-page.html", nil)
    })
    ```
3.  **Update Navigation**: Add links in:
    - `templates/header.html` (Desktop & Mobile sections)
    - `templates/footer.html`

### Modifying Styles
1.  **Edit HTML**: Use Tailwind utility classes directly in `templates/*.html`.
2.  **Edit CSS**: If custom CSS is needed, edit `src/input.css`.
3.  **Verify**: Run `npm run build:css` or `npm run watch` to ensure `static/css/styles.min.css` is updated.

### Security Checks
- **Headers**: Verify via Nginx config or browser dev tools.
- **Docker**: Ensure `USER appuser` is last in Dockerfile.
- **Dependencies**: Run `npm audit` occasionally.

## 3. Troubleshooting

### "Template Not Found"
- Check if `main.go` has `r.LoadHTMLGlob("templates/*.html")`.
- Ensure the file exists in `templates/`.

### "Styles Not Updating"
- Browser cache? Hard refresh (Cmd+Shift+R).
- Did you run `npm run build:css`?
- Check `static/css/styles.min.css` timestamp.

### Mobile Menu Issues
- The mobile menu overlay MUST have a higher z-index than content.
- **Fix**: Use `z-index: 9999 !important` and move `mobileMenuOverlay` to be a direct child of `body` if possible (or outside `nav`).
