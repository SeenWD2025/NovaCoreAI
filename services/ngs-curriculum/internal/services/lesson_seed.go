package services

import (
	"encoding/json"
	"fmt"
	"log"

	"github.com/google/uuid"
	"noble-ngs-curriculum/internal/database"
)

type lessonDef struct {
	LevelID          int
	Order            int
	Title            string
	Type             string
	CoreLesson       string
	HumanPractice    string
	ReflectionPrompt string
	AgentUnlock      string
	XP               int
	Minutes          int
	Required         bool
}

// SeedLessons inserts baseline lesson content for each level if missing.
// Minimal core seed; idempotent per (level_id, lesson_order). Also generates CS, DS, Ethical AI, and ML/AI Eng tracks per level.
func SeedLessons(db *database.DB) error {
	// 1) Baseline core lessons (order=1)
	baseline := []lessonDef{
		{1, 1, "Awakening to Signal & Self", "tutorial", "Differentiate internal vs external signal.", "For one hour, label each thought: mine / environment / echo.", "What patterns repeated most?", "Enable basic memory recall + reflection logging", 50, 45, true},
		{2, 1, "Daily Observation Discipline", "practice", "Establish a daily 5-min scan routine.", "Set 3 alarms; each alarm do a 1-min sensory + thought scan.", "When were you least present? Why?", "Track daily presence metric", 50, 30, true},
		{3, 1, "Ethics Foundations", "tutorial", "Introduce integrity, stewardship, aligned growth triad.", "Identify one past shortcut; rewrite it with aligned choice.", "Where did misalignment originate?", "Unlock ethical decision checklist", 60, 50, true},
		{4, 1, "Signal → Expression Pipeline", "exercise", "Map raw perception to structured communication.", "Translate 3 vague feelings into structured statements.", "Which transformation was hardest?", "Enable clarity scoring heuristic", 50, 35, true},
		{5, 1, "Regulation Loop", "tutorial", "Teach trigger → awareness → reframe → action loop.", "Simulate a recent trigger; rehearse full loop twice.", "Which stage broke down?", "Unlock emotional baseline tracker", 50, 40, true},
		{6, 1, "Cognitive Decomposition", "exercise", "Break complex tasks into atomic units.", "Decompose a personal goal into 7+ atomic actions.", "Which atoms were ambiguous?", "Agent can suggest atom clarifications", 60, 45, true},
		{7, 1, "System Mapping", "tutorial", "Draw inputs, transforms, outputs, feedback for a known system.", "Map a daily routine as a system w/ feedback loops.", "Where is unintended waste generated?", "Unlock basic systems diagram memory", 60, 50, true},
		{8, 1, "Pattern Library Initiation", "exercise", "Catalog 5 recurring patterns you observe.", "Record occurrences of one pattern for 24h.", "What drives its emergence?", "Enable pattern frequency tracker", 55, 40, true},
		{9, 1, "Collaborative Roles", "tutorial", "Define roles: initiator, synthesizer, challenger, stabilizer.", "In last team effort, assign retro roles; evaluate gaps.", "Which role do you overuse?", "Unlock role-balancing suggestions", 55, 45, true},
		{10, 1, "Resilience Diagnostics", "exercise", "Assess recovery speed after cognitive strain.", "After focused work, log recovery markers (clarity, energy).", "Which marker lags?", "Enable recovery recommendation prompts", 55, 40, true},
		{11, 1, "Creative Fusion Drill", "exercise", "Combine 2 unrelated domains into a prototype concept.", "Pick 2 random fields; sketch a useful hybrid.", "What constraint generated novelty?", "Unlock creative association engine", 65, 55, true},
		{12, 1, "Agent Design Primer", "tutorial", "Define purpose, boundaries, memory, interaction loops.", "Outline an agent spec for a small daily task.", "Which boundary is least defined?", "Unlock agent instantiation UI", 75, 60, true},
		{13, 1, "Meta-Reflection Framework", "exercise", "Layer: event → reaction → lesson → system update.", "Apply framework to 2 recent decisions.", "Which layer was thin?", "Enhance reflection quality scoring", 60, 50, true},
		{14, 1, "Identity-Aligned Habit", "tutorial", "Tie habit formation to identity narrative.", "Reframe a weak habit as identity expression.", "What identity tension surfaced?", "Agent monitors habit adherence", 60, 45, true},
		{15, 1, "Judgment Balancing", "exercise", "Weigh speed vs risk vs quality vs ethics on a matrix.", "Score a pending decision across 4 axes.", "Which axis is undervalued?", "Unlock judgment matrix template", 65, 55, true},
		{16, 1, "Compassionate Influence", "tutorial", "Blend empathy + clarity + boundary signaling.", "Draft a message balancing compassion + firmness.", "Where did tone misalign intent?", "Agent suggests language tuning", 65, 50, true},
		{17, 1, "Adaptive Learning Stack", "exercise", "Design your personalized acquisition loop.", "Specify trigger → capture → encode → apply → review.", "Which stage is weakest?", "Unlock learning loop optimizer", 70, 55, true},
		{18, 1, "Distributed Sync Protocol", "tutorial", "Create check-in cadence + conflict resolution primitives.", "Draft a lightweight sync protocol for a 3-person team.", "Where might drift occur?", "Enable collaborative protocol generator", 70, 55, true},
		{19, 1, "Emergent System Probe", "exercise", "Run safe probes to reveal hidden dynamics.", "Design a small probe in a system you use daily.", "What unexpected variable appeared?", "Unlock probe design assistant", 75, 60, true},
		{20, 1, "Optimization Scan", "exercise", "Identify inefficiency categories: latency, error, waste, misalignment.", "Run a 15-min scan on one recurring workflow.", "Which category dominated?", "Enable optimization opportunity list", 75, 55, true},
		{21, 1, "Stewardship Commitments", "tutorial", "Draft long-horizon responsibility statements.", "Write 3 stewardship commitments with scope + guardrails.", "Which has highest leverage?", "Unlock stewardship tracking ledger", 80, 60, true},
		{22, 1, "Legacy Vector Mapping", "exercise", "Chart potential compounding contribution paths.", "Map 5-year ripple effects of one initiative.", "Which effect is fragile?", "Agent highlights durability gaps", 80, 60, true},
		{23, 1, "Collective Intelligence Mesh", "tutorial", "Define flows between heterogeneous reasoning nodes.", "Sketch a mesh of 4 agents + 2 humans solving a task.", "Where does coherence fracture?", "Unlock orchestration pattern suggestions", 85, 65, true},
		{24, 1, "Noble Core Integration", "reflection", "Synthesize ethics, mastery, impact into operating charter.", "Write your Noble Core charter (purpose, principles, commitments).", "Where is alignment still inconsistent?", "Finalize high-level agent governance layer", 100, 75, true},
	}

	for _, def := range baseline {
		seedLesson(db, def)
	}

	// 2) Generated tracks per level (orders 2..5)
	for lvl := 1; lvl <= 24; lvl++ {
		stage := stageForLevel(lvl)
		xp := map[string]int{"Beginner": 50, "Intermediate": 60, "Advanced": 70, "Expert": 80}[stage]
		mins := map[string]int{"Beginner": 35, "Intermediate": 45, "Advanced": 55, "Expert": 65}[stage]

		// CS
		seedLesson(db, lessonDef{
			LevelID: lvl, Order: 2, Type: "tutorial",
			Title:            fmt.Sprintf("Computer Science (%s)", stage),
			CoreLesson:       csCore(stage),
			HumanPractice:    csPractice(stage),
			ReflectionPrompt: "What concept felt least intuitive and why?",
			AgentUnlock:      "Enable CS track helper",
			XP:               xp, Minutes: mins, Required: true,
		})

		// Data Science
		seedLesson(db, lessonDef{
			LevelID: lvl, Order: 3, Type: "exercise",
			Title:            fmt.Sprintf("Data Science (%s)", stage),
			CoreLesson:       dsCore(stage),
			HumanPractice:    dsPractice(stage),
			ReflectionPrompt: "What signal did the data reveal that you didn't expect?",
			AgentUnlock:      "Enable DS notebook templates",
			XP:               xp, Minutes: mins, Required: true,
		})

		// Ethical AI
		seedLesson(db, lessonDef{
			LevelID: lvl, Order: 4, Type: "tutorial",
			Title:            fmt.Sprintf("Ethical AI Use (%s)", stage),
			CoreLesson:       ethicalCore(stage),
			HumanPractice:    ethicalPractice(stage),
			ReflectionPrompt: "Where might unintended harm arise in your current work?",
			AgentUnlock:      "Enable ethical checklist & model card starter",
			XP:               xp, Minutes: mins, Required: true,
		})

		// ML/AI Engineering
		seedLesson(db, lessonDef{
			LevelID: lvl, Order: 5, Type: "exercise",
			Title:            fmt.Sprintf("ML/AI Engineering (%s)", stage),
			CoreLesson:       mlCore(stage),
			HumanPractice:    mlPractice(stage),
			ReflectionPrompt: "What tradeoff did you manage (bias/variance, latency/quality)?",
			AgentUnlock:      "Enable ML pipeline templates",
			XP:               xp, Minutes: mins, Required: true,
		})
	}

	return nil
}

func seedLesson(db *database.DB, def lessonDef) {
	// Check existence by (level_id, lesson_order)
	var existingID uuid.UUID
	err := db.QueryRow(`SELECT id FROM lessons WHERE level_id = $1 AND lesson_order = $2`, def.LevelID, def.Order).Scan(&existingID)
	if err == nil {
		return
	}
	prereqJSON, _ := json.Marshal(map[string]interface{}{"min_level": def.LevelID})
	metadataJSON, _ := json.Marshal(map[string]interface{}{"version": 1})
	_, insertErr := db.Exec(`
		INSERT INTO lessons (
			id, level_id, title, description, lesson_order, lesson_type, content_markdown,
			core_lesson, human_practice, reflection_prompt, agent_unlock, xp_reward,
			estimated_minutes, prerequisites, metadata, is_required
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
	`, uuid.New(), def.LevelID, def.Title, def.CoreLesson, def.Order, def.Type, "# "+def.Title+"\n\n"+def.CoreLesson, def.CoreLesson, def.HumanPractice, def.ReflectionPrompt, def.AgentUnlock, def.XP, def.Minutes, prereqJSON, metadataJSON, def.Required)
	if insertErr != nil {
		log.Printf("Failed inserting lesson L%d.%d: %v", def.LevelID, def.Order, insertErr)
		return
	}
	log.Printf("Seeded lesson L%d.%d - %s", def.LevelID, def.Order, def.Title)
}

func stageForLevel(lvl int) string {
	switch {
	case lvl <= 6:
		return "Beginner"
	case lvl <= 12:
		return "Intermediate"
	case lvl <= 18:
		return "Advanced"
	default:
		return "Expert"
	}
}

func csCore(stage string) string {
	switch stage {
	case "Beginner":
		return "Computing basics, command line, variables, and flow control."
	case "Intermediate":
		return "Core data structures, algorithms, and API/HTTP foundations."
	case "Advanced":
		return "Distributed systems, networking, and performance profiling."
	default:
		return "Scalability, fault tolerance, security-by-design, and resilience."
	}
}

func csPractice(stage string) string {
	switch stage {
	case "Beginner":
		return "Install a CLI, write a script that reads input and prints results."
	case "Intermediate":
		return "Implement a queue/stack and benchmark O(n) vs O(log n) operations."
	case "Advanced":
		return "Sketch a distributed service with retry/backoff and idempotency keys."
	default:
		return "Design a fault-tolerant service with circuit breakers and health probes."
	}
}

func dsCore(stage string) string {
	switch stage {
	case "Beginner":
		return "Data literacy, CSV handling, basic cleaning, and simple visualization."
	case "Intermediate":
		return "Feature engineering, SQL analytics, and experiment design."
	case "Advanced":
		return "Time series, causal inference basics, and streaming data."
	default:
		return "Privacy-preserving analytics, federated scenarios, and big data pipelines."
	}
}

func dsPractice(stage string) string {
	switch stage {
	case "Beginner":
		return "Load a CSV, clean nulls, plot 2 charts; summarize 3 insights."
	case "Intermediate":
		return "Create features from raw text/timestamps; write 3 SQL queries with GROUP BY."
	case "Advanced":
		return "Build a rolling mean forecast; outline a causal DAG for a business question."
	default:
		return "Prototype a privacy-preserving analysis plan for a multi-tenant dataset."
	}
}

func ethicalCore(stage string) string {
	switch stage {
	case "Beginner":
		return "Intro to responsible AI: bias, privacy, consent, and transparency."
	case "Intermediate":
		return "Fairness metrics, model cards, and basic explainability practices."
	case "Advanced":
		return "Risk assessment, human-in-the-loop safeguards, and monitoring for harms."
	default:
		return "Governance, audits, red-teaming, and alignment objectives in production."
	}
}

func ethicalPractice(stage string) string {
	switch stage {
	case "Beginner":
		return "Draft a simple data consent statement and list 3 bias sources."
	case "Intermediate":
		return "Compute a fairness metric on a sample; write a one-page model card."
	case "Advanced":
		return "Propose HITL checkpoints and incident runbook for a deployed model."
	default:
		return "Design a governance rubric and a red-team plan for a critical AI system."
	}
}

func mlCore(stage string) string {
	switch stage {
	case "Beginner":
		return "ML concepts, linear/logistic regression, and evaluation basics."
	case "Intermediate":
		return "Trees/ensembles, hyperparameter tuning, pipelines, and serving."
	case "Advanced":
		return "Transformers, embeddings, RAG, and task-specific fine-tuning."
	default:
		return "Distributed training, RL, multi-agent orchestration, and drift handling."
	}
}

func mlPractice(stage string) string {
	switch stage {
	case "Beginner":
		return "Train a small regression/classification model; compute accuracy/MAE."
	case "Intermediate":
		return "Tune a random forest; package a simple REST serving endpoint."
	case "Advanced":
		return "Embed a corpus and build RAG over it; evaluate retrieval quality."
	default:
		return "Outline a distributed training plan and monitoring dashboard for drift."
	}
}
