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

// Lesson represents a learning lesson with full NGS curriculum content
type Lesson struct {
	ID               uuid.UUID       `json:"id"`
	LevelID          int             `json:"level_id"`
	Title            string          `json:"title"`
	Description      string          `json:"description"`
	LessonOrder      int             `json:"lesson_order"`
	LessonType       string          `json:"lesson_type"` // tutorial, exercise, quiz, challenge, reflection
	ContentMarkdown  string          `json:"content_markdown,omitempty"`
	CoreLesson       string          `json:"core_lesson"`
	HumanPractice    string          `json:"human_practice"`
	ReflectionPrompt string          `json:"reflection_prompt"`
	AgentUnlock      string          `json:"agent_unlock"`
	XPReward         int             `json:"xp_reward"`
	EstimatedMinutes int             `json:"estimated_minutes"`
	Prerequisites    json.RawMessage `json:"prerequisites,omitempty"`
	Metadata         json.RawMessage `json:"metadata,omitempty"`
	IsRequired       bool            `json:"is_required"`
	CreatedAt        time.Time       `json:"created_at"`
	UpdatedAt        time.Time       `json:"updated_at"`
}

// LessonCompletion tracks user lesson completions
type LessonCompletion struct {
	ID               uuid.UUID       `json:"id"`
	UserID           uuid.UUID       `json:"user_id"`
	LessonID         uuid.UUID       `json:"lesson_id"`
	Score            int             `json:"score,omitempty"`
	TimeSpentSeconds int             `json:"time_spent_seconds,omitempty"`
	ReflectionText   string          `json:"reflection_text,omitempty"`
	CompletionData   json.RawMessage `json:"completion_data,omitempty"`
	CompletedAt      time.Time       `json:"completed_at"`
}

// Challenge represents a coding or practice challenge
type Challenge struct {
	ID               uuid.UUID       `json:"id"`
	LessonID         uuid.UUID       `json:"lesson_id,omitempty"`
	LevelID          int             `json:"level_id"`
	Title            string          `json:"title"`
	Description      string          `json:"description"`
	ChallengeType    string          `json:"challenge_type"` // coding, design, reflection, collaboration
	Difficulty       string          `json:"difficulty"`     // easy, medium, hard, expert
	StarterCode      string          `json:"starter_code,omitempty"`
	TestCases        json.RawMessage `json:"test_cases,omitempty"`
	SolutionTemplate string          `json:"solution_template,omitempty"`
	XPReward         int             `json:"xp_reward"`
	TimeLimitMinutes int             `json:"time_limit_minutes,omitempty"`
	Tags             []string        `json:"tags,omitempty"`
	Metadata         json.RawMessage `json:"metadata,omitempty"`
	IsActive         bool            `json:"is_active"`
	CreatedAt        time.Time       `json:"created_at"`
}

// ChallengeSubmission tracks user challenge attempts
type ChallengeSubmission struct {
	ID               uuid.UUID       `json:"id"`
	UserID           uuid.UUID       `json:"user_id"`
	ChallengeID      uuid.UUID       `json:"challenge_id"`
	SubmissionCode   string          `json:"submission_code,omitempty"`
	TestResults      json.RawMessage `json:"test_results,omitempty"`
	Passed           bool            `json:"passed"`
	Score            int             `json:"score,omitempty"`
	Feedback         string          `json:"feedback,omitempty"`
	TimeTakenSeconds int             `json:"time_taken_seconds,omitempty"`
	SubmittedAt      time.Time       `json:"submitted_at"`
}

// UserReflection represents a user's reflection on a lesson or practice
type UserReflection struct {
	ID               uuid.UUID `json:"id"`
	UserID           uuid.UUID `json:"user_id"`
	LessonID         uuid.UUID `json:"lesson_id,omitempty"`
	LevelNumber      int       `json:"level_number,omitempty"`
	ReflectionPrompt string    `json:"reflection_prompt"`
	ReflectionText   string    `json:"reflection_text"`
	QualityScore     float64   `json:"quality_score,omitempty"` // AI-assessed quality
	XPAwarded        int       `json:"xp_awarded"`
	IsPublic         bool      `json:"is_public"`
	CreatedAt        time.Time `json:"created_at"`
}

// Request/Response DTOs

// CompleteLessonRequest is the request body for completing a lesson
type CompleteLessonRequest struct {
	LessonID         uuid.UUID              `json:"lesson_id"`
	Score            int                    `json:"score,omitempty"`
	TimeSpentSeconds int                    `json:"time_spent_seconds,omitempty"`
	ReflectionText   string                 `json:"reflection_text,omitempty"`
	Metadata         map[string]interface{} `json:"metadata,omitempty"`
}

// AwardXPRequest is the request body for awarding XP
type AwardXPRequest struct {
	Source   string                 `json:"source"`
	Amount   int                    `json:"amount,omitempty"` // Optional: override default
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

// SubmitReflectionRequest for submitting a reflection
type SubmitReflectionRequest struct {
	LessonID         uuid.UUID `json:"lesson_id,omitempty"`
	LevelNumber      int       `json:"level_number,omitempty"`
	ReflectionPrompt string    `json:"reflection_prompt"`
	ReflectionText   string    `json:"reflection_text"`
	IsPublic         bool      `json:"is_public,omitempty"`
}

// SubmitChallengeRequest for submitting a challenge solution
type SubmitChallengeRequest struct {
	ChallengeID    uuid.UUID `json:"challenge_id"`
	SubmissionCode string    `json:"submission_code"`
}

// LessonWithCompletion includes lesson data and user completion status
type LessonWithCompletion struct {
	Lesson
	Completed   bool      `json:"completed"`
	CompletedAt time.Time `json:"completed_at,omitempty"`
	UserScore   int       `json:"user_score,omitempty"`
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
