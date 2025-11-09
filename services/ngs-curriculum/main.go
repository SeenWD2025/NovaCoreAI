package main

import (
	"fmt"
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
)

func main() {
	app := fiber.New()

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":  "healthy",
			"service": "ngs-curriculum",
			"note":    "Phase 9 - Coming Soon",
		})
	})

	app.Use(func(c *fiber.Ctx) error {
		return c.Status(501).JSON(fiber.Map{
			"error":   "Not Implemented",
			"message": "NGS Curriculum Service - Phase 9",
		})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "9000"
	}

	fmt.Printf("🎓 NGS Curriculum stub running on port %s (Phase 9 - Coming Soon)\n", port)
	log.Fatal(app.Listen("0.0.0.0:" + port))
}
