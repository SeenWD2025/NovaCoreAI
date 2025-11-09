package services

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"noble-ngs-curriculum/internal/config"
	"noble-ngs-curriculum/internal/database"
	"noble-ngs-curriculum/internal/models"

	"github.com/google/uuid"
)

type ProgressService struct {
	db     *database.DB
	config *config.Config
}

func NewProgressService(db *database.DB, cfg *config.Config) *ProgressService {
	return &ProgressService{
		db:     db,
		config: cfg,
	}
}

// GetProgress retrieves or creates user progress
func (s *ProgressService) GetProgress(userID uuid.UUID) (*models.ProgressResponse, error) {
	var progress models.UserProgress

	err := s.db.QueryRow(`
		SELECT id, user_id, current_level, total_xp, agent_creation_unlocked, created_at, updated_at
		FROM user_progress
		WHERE user_id = $1
	`, userID).Scan(
		&progress.ID,
		&progress.UserID,
		&progress.CurrentLevel,
		&progress.TotalXP,
		&progress.AgentCreationUnlocked,
		&progress.CreatedAt,
		&progress.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		// Create new progress entry
		progress, err = s.createInitialProgress(userID)
		if err != nil {
			return nil, fmt.Errorf("failed to create initial progress: %w", err)
		}
	} else if err != nil {
		return nil, fmt.Errorf("failed to get progress: %w", err)
	}

	// Build response with level info
	response := s.buildProgressResponse(&progress)
	return response, nil
}

// createInitialProgress creates a new progress entry for a user
func (s *ProgressService) createInitialProgress(userID uuid.UUID) (models.UserProgress, error) {
	var progress models.UserProgress
	err := s.db.QueryRow(`
		INSERT INTO user_progress (user_id, current_level, total_xp, agent_creation_unlocked)
		VALUES ($1, 1, 0, false)
		RETURNING id, user_id, current_level, total_xp, agent_creation_unlocked, created_at, updated_at
	`, userID).Scan(
		&progress.ID,
		&progress.UserID,
		&progress.CurrentLevel,
		&progress.TotalXP,
		&progress.AgentCreationUnlocked,
		&progress.CreatedAt,
		&progress.UpdatedAt,
	)

	if err != nil {
		return progress, fmt.Errorf("failed to insert initial progress: %w", err)
	}

	log.Printf("Created initial progress for user %s", userID)
	return progress, nil
}

// AwardXP awards XP to a user and updates their level
func (s *ProgressService) AwardXP(userID uuid.UUID, source string, amount int, metadata map[string]interface{}) (*models.ProgressResponse, error) {
	// If amount not specified, use default from config
	if amount <= 0 {
		if defaultAmount, ok := s.config.XPSources[source]; ok {
			amount = defaultAmount
		} else {
			amount = 10 // fallback
		}
	}

	// Start transaction
	tx, err := s.db.Begin()
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Get current progress
	var progress models.UserProgress
	err = tx.QueryRow(`
		SELECT id, user_id, current_level, total_xp, agent_creation_unlocked, created_at, updated_at
		FROM user_progress
		WHERE user_id = $1
		FOR UPDATE
	`, userID).Scan(
		&progress.ID,
		&progress.UserID,
		&progress.CurrentLevel,
		&progress.TotalXP,
		&progress.AgentCreationUnlocked,
		&progress.CreatedAt,
		&progress.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		// Create initial progress
		progress, err = s.createInitialProgress(userID)
		if err != nil {
			return nil, err
		}
	} else if err != nil {
		return nil, fmt.Errorf("failed to get progress: %w", err)
	}

	// Record XP event
	metadataJSON, _ := json.Marshal(metadata)
	_, err = tx.Exec(`
		INSERT INTO xp_events (user_id, source, xp_awarded, metadata)
		VALUES ($1, $2, $3, $4)
	`, userID, source, amount, metadataJSON)

	if err != nil {
		return nil, fmt.Errorf("failed to record XP event: %w", err)
	}

	// Update total XP
	newTotalXP := progress.TotalXP + amount

	// Calculate new level
	newLevel := s.calculateLevel(newTotalXP)

	// Check if level up occurred
	leveledUp := newLevel > progress.CurrentLevel

	// Check if agent creation should be unlocked
	agentUnlocked := progress.AgentCreationUnlocked || (newLevel >= s.config.AgentUnlockLevel)

	// Update progress
	_, err = tx.Exec(`
		UPDATE user_progress
		SET total_xp = $1, current_level = $2, agent_creation_unlocked = $3, updated_at = NOW()
		WHERE user_id = $4
	`, newTotalXP, newLevel, agentUnlocked, userID)

	if err != nil {
		return nil, fmt.Errorf("failed to update progress: %w", err)
	}

	// If leveled up, record achievement
	if leveledUp {
		achievementData := map[string]interface{}{
			"from_level": progress.CurrentLevel,
			"to_level":   newLevel,
			"xp":         newTotalXP,
		}
		achievementJSON, _ := json.Marshal(achievementData)

		_, err = tx.Exec(`
			INSERT INTO achievements (user_id, achievement_type, achievement_data)
			VALUES ($1, $2, $3)
		`, userID, "level_up", achievementJSON)

		if err != nil {
			log.Printf("Warning: Failed to record level-up achievement: %v", err)
		}
	}

	// If agent creation unlocked, record achievement
	if agentUnlocked && !progress.AgentCreationUnlocked {
		achievementData := map[string]interface{}{
			"level": newLevel,
		}
		achievementJSON, _ := json.Marshal(achievementData)

		_, err = tx.Exec(`
			INSERT INTO achievements (user_id, achievement_type, achievement_data)
			VALUES ($1, $2, $3)
		`, userID, "agent_creation_unlocked", achievementJSON)

		if err != nil {
			log.Printf("Warning: Failed to record agent unlock achievement: %v", err)
		}
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	// Get updated progress
	progress.TotalXP = newTotalXP
	progress.CurrentLevel = newLevel
	progress.AgentCreationUnlocked = agentUnlocked
	progress.UpdatedAt = time.Now()

	response := s.buildProgressResponse(&progress)
	return response, nil
}

// calculateLevel determines the level based on total XP
func (s *ProgressService) calculateLevel(totalXP int) int {
	level := 1
	for i, threshold := range s.config.LevelUpXPThresholds {
		if totalXP >= threshold {
			level = i + 1
		} else {
			break
		}
	}
	return level
}

// buildProgressResponse enriches progress with level info
func (s *ProgressService) buildProgressResponse(progress *models.UserProgress) *models.ProgressResponse {
	response := &models.ProgressResponse{
		UserProgress: *progress,
	}

	// Get current level info
	if progress.CurrentLevel > 0 && progress.CurrentLevel <= len(s.config.LevelUpXPThresholds) {
		currentLevel, _ := s.GetLevel(progress.CurrentLevel)
		response.CurrentLevelInfo = currentLevel
	}

	// Get next level info
	if progress.CurrentLevel < len(s.config.LevelUpXPThresholds) {
		nextLevel, _ := s.GetLevel(progress.CurrentLevel + 1)
		response.NextLevelInfo = nextLevel

		// Calculate XP to next level
		currentThreshold := s.config.LevelUpXPThresholds[progress.CurrentLevel-1]
		nextThreshold := s.config.LevelUpXPThresholds[progress.CurrentLevel]
		xpInCurrentLevel := progress.TotalXP - currentThreshold
		xpNeededForLevel := nextThreshold - currentThreshold

		response.XPToNextLevel = nextThreshold - progress.TotalXP
		if xpNeededForLevel > 0 {
			response.ProgressPercent = (float64(xpInCurrentLevel) / float64(xpNeededForLevel)) * 100
		}
	}

	return response
}

// GetLevel retrieves a curriculum level by level number
func (s *ProgressService) GetLevel(levelNumber int) (*models.CurriculumLevel, error) {
	var level models.CurriculumLevel
	err := s.db.QueryRow(`
		SELECT id, level_number, title, description, COALESCE(unlock_requirements, '{}'), xp_required
		FROM curriculum_levels
		WHERE level_number = $1
	`, levelNumber).Scan(
		&level.ID,
		&level.LevelNumber,
		&level.Title,
		&level.Description,
		&level.UnlockRequirements,
		&level.XPRequired,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to get level: %w", err)
	}

	return &level, nil
}

// GetAllLevels retrieves all curriculum levels
func (s *ProgressService) GetAllLevels() ([]models.CurriculumLevel, error) {
	rows, err := s.db.Query(`
		SELECT id, level_number, title, description, COALESCE(unlock_requirements, '{}'), xp_required
		FROM curriculum_levels
		ORDER BY level_number
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to query levels: %w", err)
	}
	defer rows.Close()

	var levels []models.CurriculumLevel
	for rows.Next() {
		var level models.CurriculumLevel
		err := rows.Scan(
			&level.ID,
			&level.LevelNumber,
			&level.Title,
			&level.Description,
			&level.UnlockRequirements,
			&level.XPRequired,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan level: %w", err)
		}
		levels = append(levels, level)
	}

	return levels, nil
}

// GetAchievements retrieves a user's achievements
func (s *ProgressService) GetAchievements(userID uuid.UUID) ([]models.Achievement, error) {
	rows, err := s.db.Query(`
		SELECT id, user_id, achievement_type, COALESCE(achievement_data, '{}'), unlocked_at
		FROM achievements
		WHERE user_id = $1
		ORDER BY unlocked_at DESC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to query achievements: %w", err)
	}
	defer rows.Close()

	var achievements []models.Achievement
	for rows.Next() {
		var achievement models.Achievement
		err := rows.Scan(
			&achievement.ID,
			&achievement.UserID,
			&achievement.AchievementType,
			&achievement.AchievementData,
			&achievement.UnlockedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan achievement: %w", err)
		}
		achievements = append(achievements, achievement)
	}

	return achievements, nil
}

// GetLeaderboard retrieves top users by XP
func (s *ProgressService) GetLeaderboard(limit int) ([]models.LeaderboardEntry, error) {
	if limit <= 0 {
		limit = 10
	}

	rows, err := s.db.Query(`
		SELECT 
			user_id,
			current_level,
			total_xp,
			RANK() OVER (ORDER BY total_xp DESC) as rank
		FROM user_progress
		ORDER BY total_xp DESC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query leaderboard: %w", err)
	}
	defer rows.Close()

	var entries []models.LeaderboardEntry
	for rows.Next() {
		var entry models.LeaderboardEntry
		err := rows.Scan(
			&entry.UserID,
			&entry.CurrentLevel,
			&entry.TotalXP,
			&entry.Rank,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan leaderboard entry: %w", err)
		}
		entries = append(entries, entry)
	}

	return entries, nil
}
