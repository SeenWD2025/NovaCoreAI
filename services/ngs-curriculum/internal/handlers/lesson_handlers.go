package handlers

import (
	"strconv"

	"noble-ngs-curriculum/internal/models"
	"noble-ngs-curriculum/internal/services"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type LessonHandler struct {
	lessonService *services.LessonService
}

func NewLessonHandler(lessonService *services.LessonService) *LessonHandler {
	return &LessonHandler{
		lessonService: lessonService,
	}
}

// GetLessonsByLevel handles GET /ngs/levels/:level/lessons
func (h *LessonHandler) GetLessonsByLevel(c *fiber.Ctx) error {
	// Get user ID from header
	userIDStr := c.Get("X-User-Id")
	if userIDStr == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Missing user ID",
		})
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid user ID format",
		})
	}

	// Get level from path parameter
	levelStr := c.Params("level")
	level, err := strconv.Atoi(levelStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid level number",
		})
	}

	// Validate level range
	if level < 1 || level > 24 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Level must be between 1 and 24",
		})
	}

	// Get lessons
	lessons, err := h.lessonService.GetLessonsByLevel(level, userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"level":   level,
		"lessons": lessons,
		"count":   len(lessons),
	})
}

// GetLesson handles GET /ngs/lessons/:id
func (h *LessonHandler) GetLesson(c *fiber.Ctx) error {
	// Get user ID from header
	userIDStr := c.Get("X-User-Id")
	if userIDStr == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Missing user ID",
		})
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid user ID format",
		})
	}

	// Get lesson ID from path parameter
	lessonIDStr := c.Params("id")
	lessonID, err := uuid.Parse(lessonIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid lesson ID format",
		})
	}

	// Get lesson
	lesson, err := h.lessonService.GetLesson(lessonID, userID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(lesson)
}

// CompleteLessonHandler handles POST /ngs/lessons/:id/complete
func (h *LessonHandler) CompleteLessonHandler(c *fiber.Ctx) error {
	// Get user ID from header
	userIDStr := c.Get("X-User-Id")
	if userIDStr == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Missing user ID",
		})
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid user ID format",
		})
	}

	// Get lesson ID from path parameter
	lessonIDStr := c.Params("id")
	lessonID, err := uuid.Parse(lessonIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid lesson ID format",
		})
	}

	// Parse request body
	var req models.CompleteLessonRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	// Set lesson ID from path
	req.LessonID = lessonID

	// Complete lesson
	completion, err := h.lessonService.CompleteLesson(userID, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"completion": completion,
		"message":    "Lesson completed successfully",
	})
}

// GetReflections handles GET /ngs/reflections
func (h *LessonHandler) GetReflections(c *fiber.Ctx) error {
	// Get user ID from header
	userIDStr := c.Get("X-User-Id")
	if userIDStr == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Missing user ID",
		})
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid user ID format",
		})
	}

	// Get limit from query parameter
	limit := c.QueryInt("limit", 20)
	if limit > 100 {
		limit = 100
	}

	// Get reflections
	reflections, err := h.lessonService.GetUserReflections(userID, limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"reflections": reflections,
		"count":       len(reflections),
	})
}

// SubmitReflection handles POST /ngs/reflections
func (h *LessonHandler) SubmitReflection(c *fiber.Ctx) error {
	// Get user ID from header
	userIDStr := c.Get("X-User-Id")
	if userIDStr == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Missing user ID",
		})
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid user ID format",
		})
	}

	// Parse request body
	var req models.SubmitReflectionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	// Validate request
	if req.ReflectionText == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Reflection text is required",
		})
	}

	// Submit reflection
	reflection, err := h.lessonService.SubmitReflection(userID, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"reflection": reflection,
		"message":    "Reflection submitted successfully",
	})
}
