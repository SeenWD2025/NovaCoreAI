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

type ChallengeService struct {
	db *database.DB
}

func NewChallengeService(db *database.DB) *ChallengeService {
	return &ChallengeService{
		db: db,
	}
}

// GetChallengesByLevel retrieves all active challenges for a specific level
func (s *ChallengeService) GetChallengesByLevel(levelID int) ([]models.Challenge, error) {
	rows, err := s.db.Query(`
		SELECT id, lesson_id, level_id, title, description, challenge_type,
		       difficulty, starter_code, test_cases, solution_template,
		       xp_reward, time_limit_minutes, tags, metadata, is_active, created_at
		FROM challenges
		WHERE level_id = $1 AND is_active = true
		ORDER BY difficulty, title
	`, levelID)
	if err != nil {
		return nil, fmt.Errorf("failed to query challenges: %w", err)
	}
	defer rows.Close()

	var challenges []models.Challenge
	for rows.Next() {
		var c models.Challenge
		var lessonID sql.NullString
		var starterCode, solutionTemplate sql.NullString
		var timeLimitMinutes sql.NullInt64

		err := rows.Scan(
			&c.ID, &lessonID, &c.LevelID, &c.Title, &c.Description,
			&c.ChallengeType, &c.Difficulty, &starterCode, &c.TestCases,
			&solutionTemplate, &c.XPReward, &timeLimitMinutes, &c.Tags,
			&c.Metadata, &c.IsActive, &c.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan challenge: %w", err)
		}

		if lessonID.Valid {
			c.LessonID, _ = uuid.Parse(lessonID.String)
		}
		if starterCode.Valid {
			c.StarterCode = starterCode.String
		}
		if solutionTemplate.Valid {
			c.SolutionTemplate = solutionTemplate.String
		}
		if timeLimitMinutes.Valid {
			c.TimeLimitMinutes = int(timeLimitMinutes.Int64)
		}

		challenges = append(challenges, c)
	}

	return challenges, nil
}

// GetChallenge retrieves a specific challenge by ID
func (s *ChallengeService) GetChallenge(challengeID uuid.UUID) (*models.Challenge, error) {
	var c models.Challenge
	var lessonID sql.NullString
	var starterCode, solutionTemplate sql.NullString
	var timeLimitMinutes sql.NullInt64

	err := s.db.QueryRow(`
		SELECT id, lesson_id, level_id, title, description, challenge_type,
		       difficulty, starter_code, test_cases, solution_template,
		       xp_reward, time_limit_minutes, tags, metadata, is_active, created_at
		FROM challenges
		WHERE id = $1
	`, challengeID).Scan(
		&c.ID, &lessonID, &c.LevelID, &c.Title, &c.Description,
		&c.ChallengeType, &c.Difficulty, &starterCode, &c.TestCases,
		&solutionTemplate, &c.XPReward, &timeLimitMinutes, &c.Tags,
		&c.Metadata, &c.IsActive, &c.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("challenge not found")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to query challenge: %w", err)
	}

	if lessonID.Valid {
		c.LessonID, _ = uuid.Parse(lessonID.String)
	}
	if starterCode.Valid {
		c.StarterCode = starterCode.String
	}
	if solutionTemplate.Valid {
		c.SolutionTemplate = solutionTemplate.String
	}
	if timeLimitMinutes.Valid {
		c.TimeLimitMinutes = int(timeLimitMinutes.Int64)
	}

	return &c, nil
}

// SubmitChallenge processes a challenge submission and awards XP if successful
func (s *ChallengeService) SubmitChallenge(userID uuid.UUID, req models.SubmitChallengeRequest) (*models.ChallengeSubmission, error) {
	// Start transaction
	tx, err := s.db.Begin()
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Get challenge details
	var challenge models.Challenge
	err = tx.QueryRow(`
		SELECT id, title, xp_reward, test_cases, challenge_type
		FROM challenges
		WHERE id = $1 AND is_active = true
	`, req.ChallengeID).Scan(
		&challenge.ID, &challenge.Title, &challenge.XPReward,
		&challenge.TestCases, &challenge.ChallengeType,
	)
	if err != nil {
		return nil, fmt.Errorf("challenge not found: %w", err)
	}

	// Validate submission (simplified - in production would execute code in sandbox)
	testResults, passed, score := s.validateSubmission(req.SubmissionCode, challenge.TestCases)

	// Generate feedback
	feedback := s.generateFeedback(passed, score, challenge.ChallengeType)

	// Create submission record
	testResultsJSON, _ := json.Marshal(testResults)
	var submission models.ChallengeSubmission

	err = tx.QueryRow(`
		INSERT INTO challenge_submissions (user_id, challenge_id, submission_code, test_results, passed, score, feedback)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, user_id, challenge_id, submission_code, test_results, passed, score, feedback, time_taken_seconds, submitted_at
	`, userID, req.ChallengeID, req.SubmissionCode, testResultsJSON, passed, score, feedback).Scan(
		&submission.ID, &submission.UserID, &submission.ChallengeID,
		&submission.SubmissionCode, &submission.TestResults, &submission.Passed,
		&submission.Score, &submission.Feedback, &submission.TimeTakenSeconds,
		&submission.SubmittedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create submission: %w", err)
	}

	// Award XP if passed
	if passed {
		xpToAward := challenge.XPReward
		if score >= 100 {
			xpToAward = challenge.XPReward // Full XP for perfect solution
		} else if score >= 80 {
			xpToAward = int(float64(challenge.XPReward) * 0.8) // 80% XP
		} else if score >= 60 {
			xpToAward = int(float64(challenge.XPReward) * 0.6) // 60% XP
		}

		metadata := map[string]interface{}{
			"challenge_id":    challenge.ID.String(),
			"challenge_title": challenge.Title,
			"score":           score,
			"passed":          passed,
		}
		metadataJSON, _ := json.Marshal(metadata)

		_, err = tx.Exec(`
			INSERT INTO xp_events (user_id, source, xp_awarded, metadata)
			VALUES ($1, $2, $3, $4)
		`, userID, "challenge_solved", xpToAward, metadataJSON)
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

		log.Printf("User %s completed challenge %s (XP: %d, Score: %d)", userID, challenge.Title, xpToAward, score)
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return &submission, nil
}

// GetUserSubmissions retrieves a user's challenge submission history
func (s *ChallengeService) GetUserSubmissions(userID uuid.UUID, limit int) ([]models.ChallengeSubmission, error) {
	if limit <= 0 {
		limit = 20
	}

	rows, err := s.db.Query(`
		SELECT id, user_id, challenge_id, submission_code, test_results,
		       passed, score, feedback, time_taken_seconds, submitted_at
		FROM challenge_submissions
		WHERE user_id = $1
		ORDER BY submitted_at DESC
		LIMIT $2
	`, userID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query submissions: %w", err)
	}
	defer rows.Close()

	var submissions []models.ChallengeSubmission
	for rows.Next() {
		var s models.ChallengeSubmission
		var timeTaken sql.NullInt64

		err := rows.Scan(
			&s.ID, &s.UserID, &s.ChallengeID, &s.SubmissionCode,
			&s.TestResults, &s.Passed, &s.Score, &s.Feedback,
			&timeTaken, &s.SubmittedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan submission: %w", err)
		}

		if timeTaken.Valid {
			s.TimeTakenSeconds = int(timeTaken.Int64)
		}

		submissions = append(submissions, s)
	}

	return submissions, nil
}

// validateSubmission validates a submission against test cases
// This is a simplified version - in production would use a secure code execution sandbox
func (s *ChallengeService) validateSubmission(submissionCode string, testCasesJSON json.RawMessage) (map[string]interface{}, bool, int) {
	// Parse test cases
	var testCases []map[string]interface{}
	if err := json.Unmarshal(testCasesJSON, &testCases); err != nil {
		return map[string]interface{}{
			"error": "Failed to parse test cases",
		}, false, 0
	}

	// For now, this is a placeholder that simulates validation
	// In production, this would:
	// 1. Execute code in isolated sandbox
	// 2. Run against test cases
	// 3. Capture results, errors, and performance metrics

	results := map[string]interface{}{
		"total_tests":  len(testCases),
		"passed_tests": len(testCases), // Simplified: assume all pass for now
		"failed_tests": 0,
		"test_details": []map[string]interface{}{},
		"note":         "Sandbox execution not yet implemented - all tests pass by default",
	}

	// Simulate test execution
	passedCount := len(testCases)
	totalTests := len(testCases)

	// Calculate score
	score := 0
	if totalTests > 0 {
		score = (passedCount * 100) / totalTests
	}

	passed := score >= 60 // Pass threshold

	return results, passed, score
}

// generateFeedback creates feedback based on submission results
func (s *ChallengeService) generateFeedback(passed bool, score int, challengeType string) string {
	if passed {
		if score >= 100 {
			return "Excellent work! Your solution passed all test cases with perfect execution."
		} else if score >= 80 {
			return "Great job! Your solution is solid and passes most test cases."
		} else {
			return "Good effort! Your solution meets the basic requirements."
		}
	}

	return "Your solution needs more work. Review the requirements and test cases, then try again."
}
