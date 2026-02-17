package main

import (
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
)

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
		c.HTML(http.StatusOK, "index.html", nil)
	})

	r.GET("/geo-guide", func(c *gin.Context) {
		c.HTML(http.StatusOK, "geo-guide.html", nil)
	})

	r.GET("/ai-smart-work", func(c *gin.Context) {
		c.HTML(http.StatusOK, "ai-smart-work.html", nil)
	})

	r.GET("/data-governance", func(c *gin.Context) {
		c.HTML(http.StatusOK, "data-governance.html", nil)
	})

	r.GET("/what-is-llms-txt", func(c *gin.Context) {
		c.HTML(http.StatusOK, "what-is-llms-txt.html", nil)
	})

	r.GET("/what-is-prompt-injection", func(c *gin.Context) {
		c.HTML(http.StatusOK, "what-is-prompt-injection.html", nil)
	})

	r.GET("/agent-prompting-guide", func(c *gin.Context) {
		c.HTML(http.StatusOK, "agent-prompting-guide.html", nil)
	})

	r.GET("/building", func(c *gin.Context) {
		c.HTML(http.StatusOK, "building.html", nil)
	})

	r.GET("/about", func(c *gin.Context) {
		c.HTML(http.StatusOK, "about.html", nil)
	})

	r.GET("/privacy-policy", func(c *gin.Context) {
		c.HTML(http.StatusOK, "privacy-policy.html", nil)
	})

	r.GET("/terms-of-service", func(c *gin.Context) {
		c.HTML(http.StatusOK, "terms-of-service.html", nil)
	})

	// Custom 404 Handler
	r.NoRoute(func(c *gin.Context) {
		c.HTML(http.StatusNotFound, "404.html", nil)
	})

	// Also serve /404.html explicitly for Nginx error_page redirection
	r.GET("/404.html", func(c *gin.Context) {
		c.HTML(http.StatusNotFound, "404.html", nil)
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
