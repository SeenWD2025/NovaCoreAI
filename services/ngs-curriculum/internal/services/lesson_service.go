package services

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"

	"noble-ngs-curriculum/internal/database"
	"noble-ngs-curriculum/internal/models"

	"github.com/google/uuid"
)

type LessonService struct {
	db *database.DB
}

func NewLessonService(db *database.DB) *LessonService {
	return &LessonService{
		db: db,
	}
}

// GetLessonsByLevel retrieves all lessons for a specific level
func (s *LessonService) GetLessonsByLevel(levelID int, userID uuid.UUID) ([]models.LessonWithCompletion, error) {
	rows, err := s.db.Query(`
		SELECT 
			l.id, l.level_id, l.title, l.description, l.lesson_order, l.lesson_type,
			l.content_markdown, l.core_lesson, l.human_practice, l.reflection_prompt,
			l.agent_unlock, l.xp_reward, l.estimated_minutes, l.prerequisites, 
			l.metadata, l.is_required, l.created_at, l.updated_at,
			COALESCE(lc.id IS NOT NULL, false) as completed,
			lc.completed_at, lc.score
		FROM lessons l
		LEFT JOIN lesson_completions lc ON l.id = lc.lesson_id AND lc.user_id = $1
		WHERE l.level_id = $2
		ORDER BY l.lesson_order ASC
	`, userID, levelID)
	if err != nil {
		return nil, fmt.Errorf("failed to query lessons: %w", err)
	}
	defer rows.Close()

	var lessons []models.LessonWithCompletion
	for rows.Next() {
		var l models.LessonWithCompletion
		var completedAt sql.NullTime
		var score sql.NullInt64

		err := rows.Scan(
			&l.ID, &l.LevelID, &l.Title, &l.Description, &l.LessonOrder, &l.LessonType,
			&l.ContentMarkdown, &l.CoreLesson, &l.HumanPractice, &l.ReflectionPrompt,
			&l.AgentUnlock, &l.XPReward, &l.EstimatedMinutes, &l.Prerequisites,
			&l.Metadata, &l.IsRequired, &l.CreatedAt, &l.UpdatedAt,
			&l.Completed, &completedAt, &score,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan lesson: %w", err)
		}

		if completedAt.Valid {
			l.CompletedAt = completedAt.Time
		}
		if score.Valid {
			l.UserScore = int(score.Int64)
		}

		lessons = append(lessons, l)
	}

	return lessons, nil
}

// GetLesson retrieves a specific lesson by ID
func (s *LessonService) GetLesson(lessonID uuid.UUID, userID uuid.UUID) (*models.LessonWithCompletion, error) {
	var l models.LessonWithCompletion
	var completedAt sql.NullTime
	var score sql.NullInt64

	err := s.db.QueryRow(`
		SELECT 
			l.id, l.level_id, l.title, l.description, l.lesson_order, l.lesson_type,
			l.content_markdown, l.core_lesson, l.human_practice, l.reflection_prompt,
			l.agent_unlock, l.xp_reward, l.estimated_minutes, l.prerequisites, 
			l.metadata, l.is_required, l.created_at, l.updated_at,
			COALESCE(lc.id IS NOT NULL, false) as completed,
			lc.completed_at, lc.score
		FROM lessons l
		LEFT JOIN lesson_completions lc ON l.id = lc.lesson_id AND lc.user_id = $1
		WHERE l.id = $2
	`, userID, lessonID).Scan(
		&l.ID, &l.LevelID, &l.Title, &l.Description, &l.LessonOrder, &l.LessonType,
		&l.ContentMarkdown, &l.CoreLesson, &l.HumanPractice, &l.ReflectionPrompt,
		&l.AgentUnlock, &l.XPReward, &l.EstimatedMinutes, &l.Prerequisites,
		&l.Metadata, &l.IsRequired, &l.CreatedAt, &l.UpdatedAt,
		&l.Completed, &completedAt, &score,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("lesson not found")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to query lesson: %w", err)
	}

	if completedAt.Valid {
		l.CompletedAt = completedAt.Time
	}
	if score.Valid {
		l.UserScore = int(score.Int64)
	}

	return &l, nil
}

// CompleteLesson marks a lesson as completed and awards XP
func (s *LessonService) CompleteLesson(userID uuid.UUID, req models.CompleteLessonRequest) (*models.LessonCompletion, error) {
	// Start transaction
	tx, err := s.db.Begin()
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Get lesson details
	var lesson models.Lesson
	err = tx.QueryRow(`
		SELECT id, level_id, title, xp_reward
		FROM lessons
		WHERE id = $1
	`, req.LessonID).Scan(&lesson.ID, &lesson.LevelID, &lesson.Title, &lesson.XPReward)
	if err != nil {
		return nil, fmt.Errorf("lesson not found: %w", err)
	}

	// Check if already completed
	var existingID uuid.UUID
	err = tx.QueryRow(`
		SELECT id FROM lesson_completions
		WHERE user_id = $1 AND lesson_id = $2
	`, userID, req.LessonID).Scan(&existingID)

	if err == nil {
		// Already completed, just return the existing completion
		var completion models.LessonCompletion
		err = tx.QueryRow(`
			SELECT id, user_id, lesson_id, score, time_spent_seconds, reflection_text, completion_data, completed_at
			FROM lesson_completions
			WHERE id = $1
		`, existingID).Scan(
			&completion.ID, &completion.UserID, &completion.LessonID,
			&completion.Score, &completion.TimeSpentSeconds, &completion.ReflectionText,
			&completion.CompletionData, &completion.CompletedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to get existing completion: %w", err)
		}

		log.Printf("Lesson %s already completed by user %s", req.LessonID, userID)
		return &completion, nil
	} else if err != sql.ErrNoRows {
		return nil, fmt.Errorf("failed to check completion: %w", err)
	}

	// Create lesson completion record
	var completionData json.RawMessage
	if req.Metadata != nil {
		completionData, _ = json.Marshal(req.Metadata)
	}

	var completion models.LessonCompletion
	err = tx.QueryRow(`
		INSERT INTO lesson_completions (user_id, lesson_id, score, time_spent_seconds, reflection_text, completion_data)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, user_id, lesson_id, score, time_spent_seconds, reflection_text, completion_data, completed_at
	`, userID, req.LessonID, req.Score, req.TimeSpentSeconds, req.ReflectionText, completionData).Scan(
		&completion.ID, &completion.UserID, &completion.LessonID,
		&completion.Score, &completion.TimeSpentSeconds, &completion.ReflectionText,
		&completion.CompletionData, &completion.CompletedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create completion: %w", err)
	}

	// Calculate XP based on score (for quizzes)
	xpToAward := lesson.XPReward
	if req.Score > 0 {
		if req.Score >= 100 {
			xpToAward = 100 // Perfect quiz
		} else if req.Score >= 80 {
			xpToAward = 75 // Good quiz
		} else if req.Score >= 60 {
			xpToAward = 50 // Pass quiz
		}
	}

	// Award XP
	metadata := map[string]interface{}{
		"lesson_id":    lesson.ID.String(),
		"lesson_title": lesson.Title,
		"score":        req.Score,
	}
	metadataJSON, _ := json.Marshal(metadata)

	_, err = tx.Exec(`
		INSERT INTO xp_events (user_id, source, xp_awarded, metadata)
		VALUES ($1, $2, $3, $4)
	`, userID, "lesson_completion", xpToAward, metadataJSON)
	if err != nil {
		return nil, fmt.Errorf("failed to award XP: %w", err)
	}

	// Update user progress
	_, err = tx.Exec(`
		UPDATE user_progress
		SET total_xp = total_xp + $1, updated_at = NOW()
		WHERE user_id = $2
	`, xpToAward, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to update progress: %w", err)
	}

	// Check for level up
	var newLevel int
	err = tx.QueryRow(`
		SELECT COALESCE(MAX(level_number), 1)
		FROM curriculum_levels
		WHERE xp_required <= (
			SELECT total_xp FROM user_progress WHERE user_id = $1
		)
	`, userID).Scan(&newLevel)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate new level: %w", err)
	}

	// Update level if changed
	var currentLevel int
	err = tx.QueryRow(`
		SELECT current_level FROM user_progress WHERE user_id = $1
	`, userID).Scan(&currentLevel)
	if err != nil {
		return nil, fmt.Errorf("failed to get current level: %w", err)
	}

	if newLevel > currentLevel {
		_, err = tx.Exec(`
			UPDATE user_progress
			SET current_level = $1, updated_at = NOW()
			WHERE user_id = $2
		`, newLevel, userID)
		if err != nil {
			return nil, fmt.Errorf("failed to update level: %w", err)
		}

		// Create level-up achievement
		achievementData := map[string]interface{}{
			"from_level": currentLevel,
			"to_level":   newLevel,
		}
		achievementJSON, _ := json.Marshal(achievementData)

		_, err = tx.Exec(`
			INSERT INTO achievements (user_id, achievement_type, achievement_data)
			VALUES ($1, $2, $3)
		`, userID, "level_up", achievementJSON)
		if err != nil {
			return nil, fmt.Errorf("failed to create achievement: %w", err)
		}

		log.Printf("User %s leveled up: %d → %d", userID, currentLevel, newLevel)
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	log.Printf("User %s completed lesson %s (XP: %d)", userID, lesson.Title, xpToAward)
	return &completion, nil
}

// GetUserReflections retrieves user's reflection history
func (s *LessonService) GetUserReflections(userID uuid.UUID, limit int) ([]models.UserReflection, error) {
	if limit <= 0 {
		limit = 20
	}

	rows, err := s.db.Query(`
		SELECT id, user_id, lesson_id, level_number, reflection_prompt, 
		       reflection_text, quality_score, xp_awarded, is_public, created_at
		FROM user_reflections
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`, userID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query reflections: %w", err)
	}
	defer rows.Close()

	var reflections []models.UserReflection
	for rows.Next() {
		var r models.UserReflection
		var lessonID sql.NullString
		var levelNumber sql.NullInt64
		var qualityScore sql.NullFloat64

		err := rows.Scan(
			&r.ID, &r.UserID, &lessonID, &levelNumber, &r.ReflectionPrompt,
			&r.ReflectionText, &qualityScore, &r.XPAwarded, &r.IsPublic, &r.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan reflection: %w", err)
		}

		if lessonID.Valid {
			r.LessonID, _ = uuid.Parse(lessonID.String)
		}
		if levelNumber.Valid {
			r.LevelNumber = int(levelNumber.Int64)
		}
		if qualityScore.Valid {
			r.QualityScore = qualityScore.Float64
		}

		reflections = append(reflections, r)
	}

	return reflections, nil
}

// SubmitReflection saves a user reflection and awards XP
func (s *LessonService) SubmitReflection(userID uuid.UUID, req models.SubmitReflectionRequest) (*models.UserReflection, error) {
	// Calculate quality score (simplified - in production would use AI)
	qualityScore := s.calculateReflectionQuality(req.ReflectionText)

	// Award XP based on quality
	xpAwarded := 15 // Medium quality default
	if qualityScore >= 0.8 {
		xpAwarded = 25 // High quality
	} else if qualityScore < 0.5 {
		xpAwarded = 10 // Basic quality
	}

	// Start transaction
	tx, err := s.db.Begin()
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Insert reflection
	var reflection models.UserReflection
	var lessonID interface{}
	var levelNumber interface{}

	if req.LessonID != uuid.Nil {
		lessonID = req.LessonID
	}
	if req.LevelNumber > 0 {
		levelNumber = req.LevelNumber
	}

	err = tx.QueryRow(`
		INSERT INTO user_reflections (user_id, lesson_id, level_number, reflection_prompt, 
		                               reflection_text, quality_score, xp_awarded, is_public)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, user_id, lesson_id, level_number, reflection_prompt, 
		          reflection_text, quality_score, xp_awarded, is_public, created_at
	`, userID, lessonID, levelNumber, req.ReflectionPrompt, req.ReflectionText,
		qualityScore, xpAwarded, req.IsPublic).Scan(
		&reflection.ID, &reflection.UserID, &lessonID, &levelNumber, &reflection.ReflectionPrompt,
		&reflection.ReflectionText, &reflection.QualityScore, &reflection.XPAwarded,
		&reflection.IsPublic, &reflection.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to insert reflection: %w", err)
	}

	// Award XP
	metadata := map[string]interface{}{
		"reflection_id": reflection.ID.String(),
		"quality_score": qualityScore,
	}
	metadataJSON, _ := json.Marshal(metadata)

	_, err = tx.Exec(`
		INSERT INTO xp_events (user_id, source, xp_awarded, metadata)
		VALUES ($1, $2, $3, $4)
	`, userID, "reflection_quality", xpAwarded, metadataJSON)
	if err != nil {
		return nil, fmt.Errorf("failed to award XP: %w", err)
	}

	// Update user progress
	_, err = tx.Exec(`
		UPDATE user_progress
		SET total_xp = total_xp + $1, updated_at = NOW()
		WHERE user_id = $2
	`, xpAwarded, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to update progress: %w", err)
	}

	if err = tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	log.Printf("User %s submitted reflection (XP: %d, quality: %.2f)", userID, xpAwarded, qualityScore)
	return &reflection, nil
}

// calculateReflectionQuality is a simplified quality assessment
// In production, this would integrate with an AI model
func (s *LessonService) calculateReflectionQuality(text string) float64 {
	length := len(text)

	// Basic heuristics
	if length < 50 {
		return 0.3
	} else if length < 150 {
		return 0.6
	} else if length < 300 {
		return 0.8
	}
	return 0.9
}

func (s *LessonService) UpdateLessonContent(lessonID uuid.UUID, contentMarkdown string, metadata json.RawMessage, version int) error {
	_, err := s.db.Exec(`
		UPDATE lessons
		SET content_markdown = $1, metadata = $2, content_version = $3, updated_at = NOW()
		WHERE id = $4
	`, contentMarkdown, metadata, version, lessonID)
	
	if err != nil {
		return fmt.Errorf("failed to update lesson content: %w", err)
	}
	
	log.Printf("Updated lesson %s with generated content (version %d)", lessonID, version)
	return nil
}
