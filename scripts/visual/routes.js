// Every routable page in main.go, plus the two standalone nginx error pages.
// Shared by screenshot.js and contrast.js so both always cover the same surface.

const ROUTES = [
  { path: "/", name: "index" },
  { path: "/about", name: "about" },
  { path: "/ai-smart-work", name: "ai-smart-work" },
  { path: "/geo-guide", name: "geo-guide" },
  { path: "/data-governance", name: "data-governance" },
  { path: "/what-is-llms-txt", name: "what-is-llms-txt" },
  { path: "/what-is-prompt-injection", name: "what-is-prompt-injection" },
  { path: "/agent-prompting-guide", name: "agent-prompting-guide" },
  { path: "/claude-skills-guide", name: "claude-skills-guide" },
  { path: "/adk-skill-patterns", name: "adk-skill-patterns" },
  { path: "/building", name: "building" },
  { path: "/privacy-policy", name: "privacy-policy" },
  { path: "/terms-of-service", name: "terms-of-service" },
  { path: "/404.html", name: "404" },
  { path: "/500.html", name: "500" },
  // Served directly by nginx in production — they carry their own inline styles
  // and never load styles.min.css, so they are themed by hand.
  { path: "/static/502.html", name: "502" },
  { path: "/static/503.html", name: "503" },
];

const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

const BASE_URL = process.env.BASE_URL || "http://localhost:8099";

module.exports = { ROUTES, VIEWPORTS, BASE_URL };
