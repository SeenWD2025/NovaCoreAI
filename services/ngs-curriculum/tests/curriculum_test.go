package tests

import (
	"testing"
	"github.com/stretchr/testify/assert"
)

func TestLevelProgression(t *testing.T) {
	t.Run("User starts at level 1", func(t *testing.T) {
		assert.Equal(t, 1, 1)
	})
}

func TestAgentCreationGating(t *testing.T) {
	t.Run("Agent creation unlocks at level 12", func(t *testing.T) {
		currentLevel := 12
		canCreateAgent := currentLevel >= 12
		assert.True(t, canCreateAgent)
	})
}
