# Repository Guidelines

## Project Structure & Module Organization
- `src/`: Static site source (HTML/CSS/JS and assets)
  - `index.html`, `aeo-guide.html`, `what-is-llms-txt.html`: Pages
  - `styles.css`, `script.js`: Global styles and interactivity
  - `robots.txt`, `sitemap.xml`, `llms.txt`, `site.webmanifest`: SEO/PWA/AI
  - Favicons and images (e.g., `taux-logo-*.png`, `rocket.png`)
- `Dockerfile`, `nginx.conf`, `docker-compose.yml`: Containerized nginx setup
- `README.md`: Project overview and usage

## Build, Test, and Development Commands
- `docker-compose up -d`: Build and run locally at `http://localhost:3000`
- `docker build -t taux-website .` then `docker run -d -p 8080:80 taux-website`: Manual build/run
- `live-server src --port=8080`: Lightweight local dev with reload (see README)

## Coding Style & Naming Conventions
- Indentation: 2 spaces; UTF-8; LF newlines
- HTML: Use semantic tags; keep content in `src/*.html`; avoid inline styles
- CSS: Prefer variables and responsive patterns; class names kebab-case (`.main-nav`)
- JS: Keep DOM logic in `src/script.js`; functions and variables in lowerCamelCase
- Filenames: kebab-case for assets/pages (`about-us.html`)

## Testing Guidelines
- Manual QA: Load locally, test mobile/desktop breakpoints, dark-mode behavior, and navigation
- Browser checks: Console free of errors; links and assets resolve (200s)
- SEO: Verify `robots.txt`, `sitemap.xml` and `llms.txt`; run Lighthouse for accessibility/performance
- No unit test framework is used; keep changes small and easy to verify

## Commit & Pull Request Guidelines
- Commits: Prefer Conventional Commits (e.g., `feat:`, `fix:`, `chore(nginx): ...`). Short, imperative, English or zh-TW acceptable
- PRs: Include summary, before/after screenshots (mobile + desktop), and any SEO implications; reference issues if applicable
- Scope: For new pages, update navigation, styles, `sitemap.xml` and `llms.txt`; for assets, use descriptive names and optimize size

## Security & Configuration Tips
- Do not expose server-side logic; this is a static site behind nginx
- When adjusting caching in `nginx.conf`, keep HTML no-cache and moderate cache for CSS/JS/images
