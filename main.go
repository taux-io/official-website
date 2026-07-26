package main

import (
	"html/template"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// PageData holds SEO and display data for HTML templates
type PageData struct {
	Title       string
	Description string
	Canonical   string
	Year        int
}

func main() {
	// Set Gin mode based on environment variable, default to debug
	mode := os.Getenv("GIN_MODE")
	if mode == "" {
		mode = gin.DebugMode
	}
	gin.SetMode(mode)

	r := gin.Default()

	// Security headers.
	//
	// These used to be split between here and nginx.conf, with the policy —
	// the one header that actually constrains what the page may load — living
	// only in nginx. That file was never part of the running topology:
	// deploy.prod.sh hands the app container to nginx-proxy directly, so the
	// site has been serving no policy at all while the README advertised a
	// hardened one. Setting it here means it travels with the application and
	// applies wherever the app runs.
	//
	// The sources are the ones the site actually uses. jsdelivr carries Chart.js
	// on the prompt-injection page and is the only remaining third party; the
	// Google Fonts, Tag Manager, Analytics and cdnjs origins the old policy
	// allowed are unused. 'unsafe-inline' is needed for styles — sixteen style
	// attributes and two inline blocks — but not for scripts: there is not one
	// inline event handler in the templates.
	const contentSecurityPolicy = "default-src 'self'; " +
		"script-src 'self' https://cdn.jsdelivr.net; " +
		"style-src 'self' 'unsafe-inline'; " +
		"font-src 'self'; " +
		"img-src 'self' data:; " +
		"connect-src 'self'; " +
		"frame-ancestors 'none'; " +
		"base-uri 'self'; " +
		"form-action 'self'"

	r.Use(func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Header("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
		c.Header("Content-Security-Policy", contentSecurityPolicy)
		c.Next()
	})

	// Caching for static assets, which were being served with nothing but a
	// Last-Modified date — every repeat visit paid a conditional request per
	// asset to be told nothing had changed.
	//
	// Fonts are immutable for a year: their contents never change, and a
	// replacement would arrive under a different name. Images get a week.
	//
	// CSS and JS deliberately do not get long lives, even though they are
	// cache-busted by a ?v= query. Nothing enforces that the number is
	// incremented — it is remembered, or it is not, and forgetting it while
	// serving immutable would strand every returning visitor on a stale
	// stylesheet with no way to recover. An hour plus revalidation drops
	// almost all of the round trips without betting on anyone's memory.
	r.Use(func(c *gin.Context) {
		p := c.Request.URL.Path
		switch {
		case strings.HasPrefix(p, "/static/fonts/"):
			c.Header("Cache-Control", "public, max-age=31536000, immutable")
		case strings.HasPrefix(p, "/static/og/"), strings.HasSuffix(p, ".png"),
			strings.HasSuffix(p, ".ico"), strings.HasSuffix(p, ".webmanifest"):
			c.Header("Cache-Control", "public, max-age=604800")
		case strings.HasPrefix(p, "/static/"):
			c.Header("Cache-Control", "public, max-age=3600")
		}
		c.Next()
	})

	// Derive each page's share card from its canonical URL, so adding a route
	// does not mean remembering to set an image path by hand. Cards are built
	// by scripts/assets/build-og.js from the same route table.
	r.SetFuncMap(template.FuncMap{
		"ogImage": func(canonical string) string {
			slug := strings.Trim(strings.TrimPrefix(canonical, "https://taux.io"), "/")
			if slug == "" {
				slug = "index"
			}
			return "https://taux.io/static/og/" + slug + ".png"
		},
	})

	// Load HTML templates
	r.LoadHTMLGlob("templates/*.html")

	// Serve static files
	r.Static("/static", "./static")
	// Serve specific static files that are usually at root
	r.StaticFile("/favicon.ico", "./static/favicon.ico")
	r.StaticFile("/robots.txt", "./static/robots.txt")
	r.StaticFile("/sitemap.xml", "./static/sitemap.xml")
	r.StaticFile("/llms.txt", "./static/llms.txt")
	r.StaticFile("/site.webmanifest", "./static/site.webmanifest")

	// Routes
	r.GET("/", func(c *gin.Context) {
		c.HTML(http.StatusOK, "index.html", PageData{
			Title:       "拓思科技有限公司｜TauX - AI Smart Work & GEO Solutions",
			Description: "TauX helps enterprises land AI First strategies with technology development services.",
			Canonical:   "https://taux.io/",
			Year:        time.Now().Year(),
		})
	})

	r.GET("/geo-guide", func(c *gin.Context) {
		c.HTML(http.StatusOK, "geo-guide.html", PageData{
			Title:       "GEO Guide - Generative Engine Optimization | TauX",
			Description: "Learn how to optimize your content for AI search engines like ChatGPT and Perplexity. The ultimate guide to GEO.",
			Canonical:   "https://taux.io/geo-guide",
			Year:        time.Now().Year(),
		})
	})

	r.GET("/ai-smart-work", func(c *gin.Context) {
		c.HTML(http.StatusOK, "ai-smart-work.html", PageData{
			Title:       "AI Smart Work Solutions | TauX",
			Description: "Automate workflows and enhance productivity with TauX's AI-driven smart work solutions.",
			Canonical:   "https://taux.io/ai-smart-work",
			Year:        time.Now().Year(),
		})
	})

	r.GET("/data-governance", func(c *gin.Context) {
		c.HTML(http.StatusOK, "data-governance.html", PageData{
			Title:       "Data Governance & AI Security | TauX",
			Description: "Protect your enterprise data with acceptable use policies and governance frameworks compliant with AI standards.",
			Canonical:   "https://taux.io/data-governance",
			Year:        time.Now().Year(),
		})
	})

	r.GET("/what-is-llms-txt", func(c *gin.Context) {
		c.HTML(http.StatusOK, "what-is-llms-txt.html", PageData{
			Title:       "What is LLMs.txt? | TauX GEO Tech",
			Description: "Understand the new standard for controlling AI bot access to your content. LLMs.txt explained.",
			Canonical:   "https://taux.io/what-is-llms-txt",
			Year:        time.Now().Year(),
		})
	})

	r.GET("/what-is-prompt-injection", func(c *gin.Context) {
		c.HTML(http.StatusOK, "what-is-prompt-injection.html", PageData{
			Title:       "What is Prompt Injection? | TauX Security",
			Description: "Learn about prompt injection attacks and how to secure your LLM applications against them.",
			Canonical:   "https://taux.io/what-is-prompt-injection",
			Year:        time.Now().Year(),
		})
	})

	r.GET("/agent-prompting-guide", func(c *gin.Context) {
		c.HTML(http.StatusOK, "agent-prompting-guide.html", PageData{
			Title:       "Agent Prompting Guide | TauX",
			Description: "Master the art of prompting for AI agents. Comprehensive guide for developers and power users.",
			Canonical:   "https://taux.io/agent-prompting-guide",
			Year:        time.Now().Year(),
		})
	})

	r.GET("/claude-skills-guide", func(c *gin.Context) {
		c.HTML(http.StatusOK, "claude-skills-guide.html", PageData{
			Title:       "Claude Skills 實戰指南 | TauX GEO Tech",
			Description: "Claude Skills 完整指南：學會將 SOP 與專家知識轉化為可重複使用的自動化工作流。專為開發者與團隊打造。",
			Canonical:   "https://taux.io/claude-skills-guide",
			Year:        time.Now().Year(),
		})
	})

	r.GET("/adk-skill-patterns", func(c *gin.Context) {
		c.HTML(http.StatusOK, "adk-skill-patterns.html", PageData{
			Title:       "5 種 Agent Skill 設計模式 | TauX ADK Guide",
			Description: "Google Cloud 五種 ADK Agent Skill 設計模式完整解析：Tool Wrapper、Generator、Reviewer、Inversion、Pipeline。",
			Canonical:   "https://taux.io/adk-skill-patterns",
			Year:        time.Now().Year(),
		})
	})

	r.GET("/building", func(c *gin.Context) {
		c.HTML(http.StatusOK, "building.html", PageData{
			Title:       "Building in Public | TauX",
			Description: "Follow our journey as we build TauX. Transparency, updates, and behind-the-scenes.",
			Canonical:   "https://taux.io/building",
			Year:        time.Now().Year(),
		})
	})

	r.GET("/about", func(c *gin.Context) {
		c.HTML(http.StatusOK, "about.html", PageData{
			Title:       "About TauX | AI & GEO Specialists",
			Description: "Meet the team behind TauX. We are dedicated to bridging the gap between human needs and AI capabilities.",
			Canonical:   "https://taux.io/about",
			Year:        time.Now().Year(),
		})
	})

	r.GET("/privacy-policy", func(c *gin.Context) {
		c.HTML(http.StatusOK, "privacy-policy.html", PageData{
			Title:       "Privacy Policy | TauX",
			Description: "TauX 拓思科技的隱私權政策，說明我們如何收集、使用與保護您的個人資料。了解您的資料權利與我們的安全承諾。",
			Canonical:   "https://taux.io/privacy-policy",
			Year:        time.Now().Year(),
		})
	})

	r.GET("/terms-of-service", func(c *gin.Context) {
		c.HTML(http.StatusOK, "terms-of-service.html", PageData{
			Title:       "Terms of Service | TauX",
			Description: "TauX 拓思科技的服務條款。使用我們的網站與服務前，請詳閱本條款以了解您的權利與義務，以及我們的服務範圍。",
			Canonical:   "https://taux.io/terms-of-service",
			Year:        time.Now().Year(),
		})
	})

	// Custom 404 Handler
	r.NoRoute(func(c *gin.Context) {
		c.HTML(http.StatusNotFound, "404.html", PageData{
			Title:       "404 Not Found | TauX",
			Description: "The page you are looking for does not exist.",
			Canonical:   "https://taux.io/404",
			Year:        time.Now().Year(),
		})
	})

	// Also serve /404.html explicitly for Nginx error_page redirection
	r.GET("/404.html", func(c *gin.Context) {
		c.HTML(http.StatusNotFound, "404.html", PageData{
			Title:       "404 Not Found | TauX",
			Description: "The page you are looking for does not exist.",
			Canonical:   "https://taux.io/404",
			Year:        time.Now().Year(),
		})
	})

	// Also serve /500.html explicitly for Nginx error_page redirection (500, 502, 503)
	r.GET("/500.html", func(c *gin.Context) {
		c.HTML(http.StatusInternalServerError, "500.html", PageData{
			Title:       "500 Internal Server Error | TauX",
			Description: "Something went wrong on our end.",
			Canonical:   "https://taux.io/500",
			Year:        time.Now().Year(),
		})
	})

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status": "ok",
		})
	})

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to run server: %v", err)
	}
}
