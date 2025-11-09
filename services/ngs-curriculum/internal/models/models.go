package models

import (
	"database/sql/driver"
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// UserProgress tracks a user's overall progress in the curriculum
type UserProgress struct {
	ID                    uuid.UUID `json:"id"`
	UserID                uuid.UUID `json:"user_id"`
	CurrentLevel          int       `json:"current_level"`
	TotalXP               int       `json:"total_xp"`
	AgentCreationUnlocked bool      `json:"agent_creation_unlocked"`
	CreatedAt             time.Time `json:"created_at"`
	UpdatedAt             time.Time `json:"updated_at"`
}

// XPEvent records an XP-earning event
type XPEvent struct {
	ID        uuid.UUID       `json:"id"`
	UserID    uuid.UUID       `json:"user_id"`
	Source    string          `json:"source"`
	XPAwarded int             `json:"xp_awarded"`
	Metadata  json.RawMessage `json:"metadata,omitempty"`
	CreatedAt time.Time       `json:"created_at"`
}

// Achievement represents an unlocked achievement
type Achievement struct {
	ID              uuid.UUID       `json:"id"`
	UserID          uuid.UUID       `json:"user_id"`
	AchievementType string          `json:"achievement_type"`
	AchievementData json.RawMessage `json:"achievement_data,omitempty"`
	UnlockedAt      time.Time       `json:"unlocked_at"`
}

// CurriculumLevel defines a level in the 24-level curriculum
type CurriculumLevel struct {
	ID                  int             `json:"id"`
	LevelNumber         int             `json:"level_number"`
	Title               string          `json:"title"`
	Description         string          `json:"description"`
	UnlockRequirements  json.RawMessage `json:"unlock_requirements,omitempty"`
	XPRequired          int             `json:"xp_required"`
}

// Lesson represents a learning lesson
type Lesson struct {
	ID          uuid.UUID       `json:"id"`
	LevelID     int             `json:"level_id"`
	Title       string          `json:"title"`
	Description string          `json:"description"`
	Content     string          `json:"content"`
	Type        string          `json:"type"` // tutorial, exercise, quiz, challenge
	XPReward    int             `json:"xp_reward"`
	Metadata    json.RawMessage `json:"metadata,omitempty"`
}

// LessonCompletion tracks user lesson completions
type LessonCompletion struct {
	ID          uuid.UUID `json:"id"`
	UserID      uuid.UUID `json:"user_id"`
	LessonID    uuid.UUID `json:"lesson_id"`
	Score       int       `json:"score,omitempty"`
	CompletedAt time.Time `json:"completed_at"`
}

// Request/Response DTOs

// CompleteLessonRequest is the request body for completing a lesson
type CompleteLessonRequest struct {
	LessonID uuid.UUID              `json:"lesson_id"`
	Score    int                    `json:"score,omitempty"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

// AwardXPRequest is the request body for awarding XP
type AwardXPRequest struct {
	Source   string                 `json:"source"`
	Amount   int                    `json:"amount,omitempty"` // Optional: override default
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

// ProgressResponse includes progress with level details
type ProgressResponse struct {
	UserProgress
	CurrentLevelInfo *CurriculumLevel `json:"current_level_info,omitempty"`
	NextLevelInfo    *CurriculumLevel `json:"next_level_info,omitempty"`
	XPToNextLevel    int              `json:"xp_to_next_level"`
	ProgressPercent  float64          `json:"progress_percent"`
}

// LeaderboardEntry represents a user on the leaderboard
type LeaderboardEntry struct {
	UserID       uuid.UUID `json:"user_id"`
	Username     string    `json:"username,omitempty"`
	CurrentLevel int       `json:"current_level"`
	TotalXP      int       `json:"total_xp"`
	Rank         int       `json:"rank"`
}

// JSONB is a custom type for PostgreSQL JSONB fields
type JSONB map[string]interface{}

// Value implements the driver.Valuer interface
func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

// Scan implements the sql.Scanner interface
func (j *JSONB) Scan(value interface{}) error {
	if value == nil {
		*j = nil
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return json.Unmarshal(value.([]byte), j)
	}
	return json.Unmarshal(bytes, j)
}
