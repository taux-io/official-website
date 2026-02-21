package main

import (
	"log"
	"net/http"
	"os"
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
			Title:       "TauX - AI Smart Work & GEO Solutions",
			Description: "TauX helps brands become the 'Answer' in AI search through Generative Engine Optimization (GEO) technology.",
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
			Description: "Our commitment to your privacy and data security.",
			Canonical:   "https://taux.io/privacy-policy",
			Year:        time.Now().Year(),
		})
	})

	r.GET("/terms-of-service", func(c *gin.Context) {
		c.HTML(http.StatusOK, "terms-of-service.html", PageData{
			Title:       "Terms of Service | TauX",
			Description: "Terms and conditions for using TauX services.",
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
