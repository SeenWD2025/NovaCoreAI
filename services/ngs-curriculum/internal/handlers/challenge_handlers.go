package handlers

import (
	"strconv"

	"noble-ngs-curriculum/internal/models"
	"noble-ngs-curriculum/internal/services"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type ChallengeHandler struct {
	challengeService *services.ChallengeService
}

func NewChallengeHandler(challengeService *services.ChallengeService) *ChallengeHandler {
	return &ChallengeHandler{
		challengeService: challengeService,
	}
}

// GetChallengesByLevel handles GET /ngs/levels/:level/challenges
func (h *ChallengeHandler) GetChallengesByLevel(c *fiber.Ctx) error {
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

	// Get challenges
	challenges, err := h.challengeService.GetChallengesByLevel(level)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"level":      level,
		"challenges": challenges,
		"count":      len(challenges),
	})
}

// GetChallenge handles GET /ngs/challenges/:id
func (h *ChallengeHandler) GetChallenge(c *fiber.Ctx) error {
	// Get challenge ID from path parameter
	challengeIDStr := c.Params("id")
	challengeID, err := uuid.Parse(challengeIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid challenge ID format",
		})
	}

	// Get challenge
	challenge, err := h.challengeService.GetChallenge(challengeID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(challenge)
}

// SubmitChallenge handles POST /ngs/challenges/:id/submit
func (h *ChallengeHandler) SubmitChallenge(c *fiber.Ctx) error {
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

	// Get challenge ID from path parameter
	challengeIDStr := c.Params("id")
	challengeID, err := uuid.Parse(challengeIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid challenge ID format",
		})
	}

	// Parse request body
	var req models.SubmitChallengeRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	// Set challenge ID from path
	req.ChallengeID = challengeID

	// Validate submission code
	if req.SubmissionCode == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Submission code is required",
		})
	}

	// Submit challenge
	submission, err := h.challengeService.SubmitChallenge(userID, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"submission": submission,
		"message":    "Challenge submission processed",
	})
}

// GetUserSubmissions handles GET /ngs/challenges/submissions
func (h *ChallengeHandler) GetUserSubmissions(c *fiber.Ctx) error {
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

	// Get submissions
	submissions, err := h.challengeService.GetUserSubmissions(userID, limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"submissions": submissions,
		"count":       len(submissions),
	})
}
