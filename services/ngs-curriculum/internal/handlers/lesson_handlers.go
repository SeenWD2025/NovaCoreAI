package handlers

import (
	"context"
	"encoding/json"
	"strconv"
	"time"

	"noble-ngs-curriculum/internal/clients/intelligence"
	"noble-ngs-curriculum/internal/models"
	"noble-ngs-curriculum/internal/services"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type LessonHandler struct {
	lessonService       *services.LessonService
	intelligenceClient  *intelligence.Client
}

func NewLessonHandler(lessonService *services.LessonService, intelligenceClient *intelligence.Client) *LessonHandler {
	return &LessonHandler{
		lessonService:      lessonService,
		intelligenceClient: intelligenceClient,
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

func (h *LessonHandler) GenerateLesson(c *fiber.Ctx) error {
	// Get user info from headers
	userIDStr := c.Get("X-User-Id")
	userEmail := c.Get("X-User-Email")
	userRole := c.Get("X-User-Role")
	
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

	// Get lesson details from database
	lesson, err := h.lessonService.GetLesson(lessonID, userID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Lesson not found",
		})
	}

	learnerProfile := intelligence.LearnerProfile{
		XP:           0, // Will be fetched from user_progress
		CurrentLevel: lesson.LevelID,
		WeakTopics:   []string{},
		PriorLessons: []string{},
		Preferences:  make(map[string]interface{}),
	}

	genReq := intelligence.GenerateLessonRequest{
		LessonSummary: lesson.Description,
		LevelNumber:   lesson.LevelID,
		LearnerProfile: learnerProfile,
		Constraints: intelligence.GenerationConstraints{
			TargetMinutes:           lesson.EstimatedMinutes,
			Prereqs:                 []string{},
			RequireEthicsGuardrails: true,
		},
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	if correlationID := c.Get("X-Correlation-ID"); correlationID != "" {
		ctx = context.WithValue(ctx, "correlation_id", correlationID)
	}

	genResp, err := h.intelligenceClient.GenerateLesson(ctx, genReq, userIDStr, userEmail, userRole)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to generate lesson: " + err.Error(),
		})
	}

	metadataJSON, err := json.Marshal(genResp.StructuredLesson)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to marshal lesson metadata",
		})
	}

	err = h.lessonService.UpdateLessonContent(lessonID, genResp.ContentMarkdown, metadataJSON, genResp.Version)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to store lesson content: " + err.Error(),
		})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"lesson_id":         lessonID,
		"content_markdown":  genResp.ContentMarkdown,
		"metadata":          genResp.StructuredLesson,
		"tokens_used":       genResp.TokensUsed,
		"provider":          genResp.Provider,
		"latency_ms":        genResp.LatencyMs,
		"version":           genResp.Version,
		"message":           "Lesson generated successfully",
	})
}

// GetLessonContent handles GET /ngs/lessons/:id/content
func (h *LessonHandler) GetLessonContent(c *fiber.Ctx) error {
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

	// Get lesson with content
	lesson, err := h.lessonService.GetLesson(lessonID, userID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Lesson not found",
		})
	}

	var metadata map[string]interface{}
	if lesson.Metadata != nil {
		if err := json.Unmarshal(lesson.Metadata, &metadata); err != nil {
			metadata = nil
		}
	}

	return c.JSON(fiber.Map{
		"lesson_id":        lessonID,
		"title":            lesson.Title,
		"content_markdown": lesson.ContentMarkdown,
		"metadata":         metadata,
		"level_id":         lesson.LevelID,
		"xp_reward":        lesson.XPReward,
		"estimated_minutes": lesson.EstimatedMinutes,
	})
}

func (h *LessonHandler) SendEducatorChatMessage(c *fiber.Ctx) error {
	// Get user info from headers
	userIDStr := c.Get("X-User-Id")
	userEmail := c.Get("X-User-Email")
	userRole := c.Get("X-User-Role")
	
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
	var req struct {
		Message   string     `json:"message"`
		SessionID *uuid.UUID `json:"session_id,omitempty"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	if req.Message == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Message is required",
		})
	}

	chatReq := intelligence.EducatorChatRequest{
		Message:   req.Message,
		LessonID:  lessonID,
		SessionID: req.SessionID,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if correlationID := c.Get("X-Correlation-ID"); correlationID != "" {
		ctx = context.WithValue(ctx, "correlation_id", correlationID)
	}

	chatResp, err := h.intelligenceClient.SendEducatorChatMessage(ctx, chatReq, userIDStr, userEmail, userRole)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to send chat message: " + err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"response":    chatResp.Response,
		"session_id":  chatResp.SessionID,
		"lesson_id":   chatResp.LessonID,
		"tokens_used": chatResp.TokensUsed,
		"latency_ms":  chatResp.LatencyMs,
	})
}
