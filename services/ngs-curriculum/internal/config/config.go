package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port                string
	DatabaseURL         string
	LevelUpXPThresholds []int
	XPSources           map[string]int
	AgentUnlockLevel    int
}

func Load() *Config {
	return &Config{
		Port:        getEnv("PORT", "9000"),
		DatabaseURL: getEnv("DATABASE_URL", "postgresql://noble:changeme@localhost:5432/noble_novacore"),
		LevelUpXPThresholds: []int{
			0,     // Level 1
			100,   // Level 2
			250,   // Level 3
			450,   // Level 4
			700,   // Level 5
			1000,  // Level 6
			1400,  // Level 7
			1900,  // Level 8
			2500,  // Level 9
			3200,  // Level 10
			4000,  // Level 11
			5000,  // Level 12 - Agent creation unlocks
			6200,  // Level 13
			7600,  // Level 14
			9200,  // Level 15
			11000, // Level 16
			13000, // Level 17
			15200, // Level 18
			17600, // Level 19
			20200, // Level 20
			23000, // Level 21
			26000, // Level 22
			29200, // Level 23
			32600, // Level 24
		},
		XPSources: map[string]int{
			"lesson_completion": 50,
			"quiz_perfect":      100,
			"quiz_good":         75,
			"quiz_pass":         50,
			"reflection_high":   25,
			"reflection_medium": 15,
			"helping_others":    10,
			"creative_solution": 75,
			"challenge_solved":  100,
			"daily_streak":      20,
		},
		AgentUnlockLevel: getEnvInt("AGENT_UNLOCK_LEVEL", 12),
	}
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if value := os.Getenv(key); value != "" {
		if intVal, err := strconv.Atoi(value); err == nil {
			return intVal
		}
	}
	return fallback
}
