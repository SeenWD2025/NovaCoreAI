package main

import (
	"log"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"noble-ngs-curriculum/internal/config"
	"noble-ngs-curriculum/internal/database"
	"noble-ngs-curriculum/internal/handlers"
	"noble-ngs-curriculum/internal/services"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/adaptor"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	httpRequests = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "ngs_http_requests_total",
			Help: "Total HTTP requests processed by the NGS curriculum service.",
		},
		[]string{"method", "route", "status"},
	)

	httpRequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "ngs_http_request_duration_seconds",
			Help:    "HTTP request latency for the NGS curriculum service.",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"route"},
	)
)

func init() {
	prometheus.MustRegister(httpRequests, httpRequestDuration)
}

func main() {
	// Load configuration
	cfg := config.Load()

	// Connect to database
	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Initialize services
	progressService := services.NewProgressService(db, cfg)
	lessonService := services.NewLessonService(db)
	challengeService := services.NewChallengeService(db)

	// Initialize handlers
	handler := handlers.NewHandler(progressService)
	lessonHandler := handlers.NewLessonHandler(lessonService)
	challengeHandler := handlers.NewChallengeHandler(challengeService)

	// Create Fiber app
	app := fiber.New(fiber.Config{
		AppName:      "Noble Growth School (NGS) Curriculum v1.0.0",
		ErrorHandler: customErrorHandler,
	})

	// Prometheus metrics endpoint
	app.Get("/metrics", adaptor.HTTPHandler(promhttp.Handler()))

	// Record basic request metrics (skip /metrics to avoid recursion)
	app.Use(func(c *fiber.Ctx) error {
		start := time.Now()
		err := c.Next()

		if route := c.Route(); route != nil && route.Path == "/metrics" {
			return err
		}

		routePattern := "unmatched"
		if route := c.Route(); route != nil {
			routePattern = route.Path
		} else {
			routePattern = c.Path()
		}

		status := strconv.Itoa(c.Response().StatusCode())
		httpRequests.WithLabelValues(c.Method(), routePattern, status).Inc()
		httpRequestDuration.WithLabelValues(routePattern).Observe(time.Since(start).Seconds())

		return err
	})

	// Middleware
	app.Use(recover.New())
	app.Use(logger.New(logger.Config{
		Format: "[${time}] ${status} - ${method} ${path} (${latency})\n",
	}))
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, X-User-Id, Authorization",
		AllowMethods: "GET, POST, PUT, PATCH, DELETE, OPTIONS",
	}))

	// Routes
	app.Get("/", handler.Info)
	app.Get("/health", handler.Health)

	// Progress routes
	app.Get("/ngs/progress", handler.GetProgress)
	app.Post("/ngs/award-xp", handler.AwardXP)
	app.Post("/ngs/complete-lesson", handler.CompleteLesson)

	// Achievement routes
	app.Get("/ngs/achievements", handler.GetAchievements)

	// Leaderboard routes
	app.Get("/ngs/leaderboard", handler.GetLeaderboard)

	// Level routes
	app.Get("/ngs/levels", handler.GetLevels)
	app.Get("/ngs/levels/:level", handler.GetLevel)

	// Lesson routes
	app.Get("/ngs/levels/:level/lessons", lessonHandler.GetLessonsByLevel)
	app.Get("/ngs/lessons/:id", lessonHandler.GetLesson)
	app.Post("/ngs/lessons/:id/complete", lessonHandler.CompleteLessonHandler)

	// Reflection routes
	app.Get("/ngs/reflections", lessonHandler.GetReflections)
	app.Post("/ngs/reflections", lessonHandler.SubmitReflection)

	// Challenge routes
	app.Get("/ngs/levels/:level/challenges", challengeHandler.GetChallengesByLevel)
	app.Get("/ngs/challenges/:id", challengeHandler.GetChallenge)
	app.Post("/ngs/challenges/:id/submit", challengeHandler.SubmitChallenge)
	app.Get("/ngs/challenges/submissions", challengeHandler.GetUserSubmissions)

	// Start server in a goroutine
	go func() {
		log.Printf("🎓 Noble Growth School (NGS) Curriculum Service")
		log.Printf("📚 24-level gamified learning curriculum")
		log.Printf("🚀 Server starting on port %s", cfg.Port)
		log.Printf("🔓 Agent creation unlocks at Level %d", cfg.AgentUnlockLevel)

		if err := app.Listen("0.0.0.0:" + cfg.Port); err != nil {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")
	if err := app.Shutdown(); err != nil {
		log.Fatalf("Server shutdown failed: %v", err)
	}

	log.Println("Server exited gracefully")
}

func customErrorHandler(c *fiber.Ctx, err error) error {
	code := fiber.StatusInternalServerError
	message := "Internal Server Error"

	if e, ok := err.(*fiber.Error); ok {
		code = e.Code
		message = e.Message
	}

	return c.Status(code).JSON(fiber.Map{
		"error": message,
	})
}
