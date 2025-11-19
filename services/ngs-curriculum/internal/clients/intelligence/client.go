package intelligence

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/google/uuid"
)

type Client struct {
	baseURL    string
	httpClient *http.Client
	getToken   func() string
}

func NewClient(baseURL string, tokenProvider func() string) *Client {
	return &Client{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		getToken: tokenProvider,
	}
}

type GenerateLessonRequest struct {
	LessonSummary  string            `json:"lesson_summary"`
	LevelNumber    int               `json:"level_number"`
	LearnerProfile LearnerProfile    `json:"learner_profile"`
	Constraints    GenerationConstraints `json:"constraints"`
}

type LearnerProfile struct {
	XP           int               `json:"xp"`
	CurrentLevel int               `json:"current_level"`
	WeakTopics   []string          `json:"weak_topics"`
	PriorLessons []string          `json:"prior_lessons"`
	Preferences  map[string]interface{} `json:"preferences"`
}

type GenerationConstraints struct {
	TargetMinutes           int      `json:"target_minutes"`
	Prereqs                 []string `json:"prereqs"`
	RequireEthicsGuardrails bool     `json:"require_ethics_guardrails"`
}

type StructuredLesson struct {
	Metadata        LessonMetadata       `json:"metadata"`
	Teach           TeachSection         `json:"teach"`
	GuidedPractice  []GuidedPracticeTask `json:"guided_practice"`
	Assessment      Assessment           `json:"assessment"`
	Summary         string               `json:"summary"`
	Artifacts       LessonArtifacts      `json:"artifacts"`
}

type LessonMetadata struct {
	Title            string   `json:"title"`
	Outcomes         []string `json:"outcomes"`
	Difficulty       string   `json:"difficulty"`
	Prerequisites    []string `json:"prerequisites"`
	EstimatedMinutes int      `json:"estimated_minutes"`
}

type TeachSection struct {
	Overview string    `json:"overview"`
	Concepts []Concept `json:"concepts"`
	Steps    []string  `json:"steps"`
	Visuals  []string  `json:"visuals"`
}

type Concept struct {
	Name        string  `json:"name"`
	Explanation string  `json:"explanation"`
	Example     string  `json:"example"`
	Analogy     *string `json:"analogy,omitempty"`
}

type GuidedPracticeTask struct {
	Task     string `json:"task"`
	Hint     string `json:"hint"`
	Solution string `json:"solution"`
}

type Assessment struct {
	Checks []AssessmentCheck `json:"checks"`
	Rubric *string           `json:"rubric,omitempty"`
}

type AssessmentCheck struct {
	Type        string      `json:"type"`
	Question    string      `json:"question"`
	Choices     []string    `json:"choices,omitempty"`
	Answer      interface{} `json:"answer"`
	Explanation string      `json:"explanation"`
}

type LessonArtifacts struct {
	QuizItems     []map[string]interface{} `json:"quiz_items"`
	NotesOutline  []map[string]interface{} `json:"notes_outline"`
	CodeSnippets  []map[string]interface{} `json:"code_snippets"`
	Glossary      []GlossaryTerm           `json:"glossary"`
}

type GlossaryTerm struct {
	Term       string `json:"term"`
	Definition string `json:"definition"`
}

type GenerateLessonResponse struct {
	StructuredLesson StructuredLesson `json:"structured_lesson"`
	ContentMarkdown  string           `json:"content_markdown"`
	TokensUsed       int              `json:"tokens_used"`
	Provider         string           `json:"provider"`
	LatencyMs        int              `json:"latency_ms"`
	Version          int              `json:"version"`
}

type EducatorChatRequest struct {
	Message   string     `json:"message"`
	LessonID  uuid.UUID  `json:"lesson_id"`
	SessionID *uuid.UUID `json:"session_id,omitempty"`
}

type EducatorChatResponse struct {
	Response   string    `json:"response"`
	SessionID  uuid.UUID `json:"session_id"`
	LessonID   uuid.UUID `json:"lesson_id"`
	TokensUsed int       `json:"tokens_used"`
	LatencyMs  int       `json:"latency_ms"`
}

func (c *Client) GenerateLesson(ctx context.Context, req GenerateLessonRequest, userID, userEmail, userRole string) (*GenerateLessonResponse, error) {
	url := fmt.Sprintf("%s/educator/generate", c.baseURL)
	
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}
	
	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("X-Service-Token", c.getToken())
	httpReq.Header.Set("X-User-Id", userID)
	httpReq.Header.Set("X-User-Email", userEmail)
	httpReq.Header.Set("X-User-Role", userRole)
	
	if correlationID := ctx.Value("correlation_id"); correlationID != nil {
		httpReq.Header.Set("X-Correlation-ID", correlationID.(string))
	}
	
	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()
	
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}
	
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("intelligence service returned status %d: %s", resp.StatusCode, string(respBody))
	}
	
	var result GenerateLessonResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}
	
	return &result, nil
}

func (c *Client) SendEducatorChatMessage(ctx context.Context, req EducatorChatRequest, userID, userEmail, userRole string) (*EducatorChatResponse, error) {
	url := fmt.Sprintf("%s/educator/chat/message", c.baseURL)
	
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}
	
	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("X-Service-Token", c.getToken())
	httpReq.Header.Set("X-User-Id", userID)
	httpReq.Header.Set("X-User-Email", userEmail)
	httpReq.Header.Set("X-User-Role", userRole)
	
	if correlationID := ctx.Value("correlation_id"); correlationID != nil {
		httpReq.Header.Set("X-Correlation-ID", correlationID.(string))
	}
	
	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()
	
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}
	
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("intelligence service returned status %d: %s", resp.StatusCode, string(respBody))
	}
	
	var result EducatorChatResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}
	
	return &result, nil
}
