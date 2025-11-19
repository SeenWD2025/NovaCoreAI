package services

import (
	"log"

	"noble-ngs-curriculum/internal/database"
)

// SeedCurriculumLevels ensures all 24 curriculum levels exist.
// It inserts any missing levels with titles, descriptions, and XP requirements.
func SeedCurriculumLevels(db *database.DB, xpThresholds []int) error {
	// Level metadata definitions
	type levelDef struct {
		Number      int
		Title       string
		Description string
		XPRequired  int
	}

	levels := []levelDef{
		{1, "Awakening to Signal", "Become aware of raw internal and external signals; differentiate noise from meaningful patterns.", xpThresholds[0]},
		{2, "Foundational Awareness", "Strengthen consistent daily observation; build a baseline of disciplined attention.", xpThresholds[1]},
		{3, "Ethical Principles", "Internalize Noble Core ethics: integrity, stewardship, aligned growth.", xpThresholds[2]},
		{4, "Communication Skills", "Develop clear, concise, context-aware expression across modalities.", xpThresholds[3]},
		{5, "Emotional Regulation", "Stabilize affective responses; cultivate calm adaptive presence.", xpThresholds[4]},
		{6, "Cognitive Clarity", "Improve structured thinking, abstraction, decomposition of problems.", xpThresholds[5]},
		{7, "Systems Thinking", "Model interacting components; reason about flows, constraints, feedback loops.", xpThresholds[6]},
		{8, "Strategic Patterning", "Recognize recurring strategic patterns; anticipate second-order effects.", xpThresholds[7]},
		{9, "Collaborative Intelligence", "Enhance co-creation; synchronize with other agents and humans effectively.", xpThresholds[8]},
		{10, "Resilient Adaptation", "Refine recovery cycles; respond constructively to volatility and failure.", xpThresholds[9]},
		{11, "Creative Synthesis", "Fuse disparate domains into novel, useful constructs and solutions.", xpThresholds[10]},
		{12, "Agentic Creation", "Unlock autonomous agent design; instantiate purposeful agent behaviors.", xpThresholds[11]},
		{13, "Reflective Mastery", "Deepen meta-cognition; optimize learning loops via structured reflection.", xpThresholds[12]},
		{14, "Embodied Discipline", "Integrate habits at identity layer; maintain consistency under pressure.", xpThresholds[13]},
		{15, "Integrative Judgment", "Balance speed, risk, ethics, and quality in consequential decisions.", xpThresholds[14]},
		{16, "Compassionate Leadership", "Guide others with empathy, clarity, and principled influence.", xpThresholds[15]},
		{17, "Meta-Learning Architectures", "Design adaptive frameworks that accelerate future skill acquisition.", xpThresholds[16]},
		{18, "Distributed Collaboration", "Coordinate multi-agent/human networks toward shared aligned outcomes.", xpThresholds[17]},
		{19, "Emergent Design", "Shape evolving systems where structure and behavior co-develop.", xpThresholds[18]},
		{20, "Adaptive Optimization", "Continuously tune processes for efficiency, robustness, and alignment.", xpThresholds[19]},
		{21, "Ethical Stewardship", "Own long-horizon impacts; act as guardian of systemic health.", xpThresholds[20]},
		{22, "Legacy Crafting", "Engineer durable contributions that compound positive effects.", xpThresholds[21]},
		{23, "Collective Intelligence Orchestration", "Integrate heterogeneous intelligences into coherent purposeful flow.", xpThresholds[22]},
		{24, "Noble Core Embodiment", "Operate as a fully aligned generative force; harmonize mastery, ethics, and impact.", xpThresholds[23]},
	}

	// Insert missing levels one by one (minimal writes)
	for _, lvl := range levels {
		var existingID int
		err := db.QueryRow(`SELECT id FROM curriculum_levels WHERE level_number = $1`, lvl.Number).Scan(&existingID)
		if err == nil {
			continue // exists
		}
		// Insert
		_, insertErr := db.Exec(`
			INSERT INTO curriculum_levels (level_number, title, description, xp_required)
			VALUES ($1, $2, $3, $4)
		`, lvl.Number, lvl.Title, lvl.Description, lvl.XPRequired)
		if insertErr != nil {
			log.Printf("Failed inserting level %d: %v", lvl.Number, insertErr)
			return insertErr
		}
		log.Printf("Seeded curriculum level %d - %s", lvl.Number, lvl.Title)
	}
	return nil
}
