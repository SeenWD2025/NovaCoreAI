package handlers

import (
	"log"
	"strconv"

	"noble-ngs-curriculum/internal/models"
	"noble-ngs-curriculum/internal/services"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type Handler struct {
	progressService *services.ProgressService
}

func NewHandler(progressService *services.ProgressService) *Handler {
	return &Handler{
		progressService: progressService,
	}
}

// getUserID extracts user ID from X-User-Id header
func getUserID(c *fiber.Ctx) (uuid.UUID, error) {
	userIDStr := c.Get("X-User-Id")
	if userIDStr == "" {
		return uuid.Nil, fiber.NewError(fiber.StatusUnauthorized, "X-User-Id header required")
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return uuid.Nil, fiber.NewError(fiber.StatusBadRequest, "Invalid user ID format")
	}

	return userID, nil
}

// GetProgress retrieves user progress
// GET /ngs/progress
func (h *Handler) GetProgress(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return err
	}

	progress, err := h.progressService.GetProgress(userID)
	if err != nil {
		log.Printf("Error getting progress for user %s: %v", userID, err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to get progress",
		})
	}

	return c.JSON(progress)
}

// AwardXP awards XP to a user
// POST /ngs/award-xp
func (h *Handler) AwardXP(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return err
	}

	var req models.AwardXPRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	if req.Source == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Source is required",
		})
	}

	progress, err := h.progressService.AwardXP(userID, req.Source, req.Amount, req.Metadata)
	if err != nil {
		log.Printf("Error awarding XP for user %s: %v", userID, err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to award XP",
		})
	}

	return c.JSON(fiber.Map{
		"message":  "XP awarded successfully",
		"progress": progress,
	})
}

// CompleteLesson marks a lesson as complete and awards XP
// POST /ngs/complete-lesson
func (h *Handler) CompleteLesson(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return err
	}

	var req models.CompleteLessonRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	// Determine XP source based on score
	source := "lesson_completion"
	if req.Score >= 100 {
		source = "quiz_perfect"
	} else if req.Score >= 80 {
		source = "quiz_good"
	} else if req.Score >= 60 {
		source = "quiz_pass"
	}

	// Add lesson_id to metadata
	if req.Metadata == nil {
		req.Metadata = make(map[string]interface{})
	}
	req.Metadata["lesson_id"] = req.LessonID.String()
	req.Metadata["score"] = req.Score

	progress, err := h.progressService.AwardXP(userID, source, 0, req.Metadata)
	if err != nil {
		log.Printf("Error completing lesson for user %s: %v", userID, err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to complete lesson",
		})
	}

	return c.JSON(fiber.Map{
		"message":  "Lesson completed successfully",
		"progress": progress,
	})
}

// GetAchievements retrieves user achievements
// GET /ngs/achievements
func (h *Handler) GetAchievements(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return err
	}

	achievements, err := h.progressService.GetAchievements(userID)
	if err != nil {
		log.Printf("Error getting achievements for user %s: %v", userID, err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to get achievements",
		})
	}

	return c.JSON(fiber.Map{
		"achievements": achievements,
		"count":        len(achievements),
	})
}

// GetLeaderboard retrieves the leaderboard
// GET /ngs/leaderboard
func (h *Handler) GetLeaderboard(c *fiber.Ctx) error {
	limit := 10
	if limitStr := c.Query("limit"); limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 {
			limit = parsedLimit
		}
	}

	leaderboard, err := h.progressService.GetLeaderboard(limit)
	if err != nil {
		log.Printf("Error getting leaderboard: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to get leaderboard",
		})
	}

	return c.JSON(fiber.Map{
		"leaderboard": leaderboard,
		"count":       len(leaderboard),
	})
}

// GetLevels retrieves all curriculum levels
// GET /ngs/levels
func (h *Handler) GetLevels(c *fiber.Ctx) error {
	levels, err := h.progressService.GetAllLevels()
	if err != nil {
		log.Printf("Error getting levels: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to get levels",
		})
	}

	return c.JSON(fiber.Map{
		"levels": levels,
		"count":  len(levels),
	})
}

// GetLevel retrieves a specific level
// GET /ngs/levels/:level
func (h *Handler) GetLevel(c *fiber.Ctx) error {
	levelNum, err := strconv.Atoi(c.Params("level"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid level number",
		})
	}

	level, err := h.progressService.GetLevel(levelNum)
	if err != nil {
		log.Printf("Error getting level %d: %v", levelNum, err)
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Level not found",
		})
	}

	return c.JSON(level)
}

// Health check
// GET /health
func (h *Handler) Health(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"status":  "healthy",
		"service": "ngs-curriculum",
		"version": "1.0.0",
	})
}

// Service info
// GET /
func (h *Handler) Info(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"service":     "Noble Growth School (NGS) Curriculum",
		"version":     "1.0.0",
		"description": "24-level gamified learning curriculum with XP and achievements",
		"features": []string{
			"24-level progression system",
			"XP event tracking",
			"Achievement system",
			"Leaderboard",
			"Agent creation gating (Level 12)",
		},
	})
}
