-- Insert remaining curriculum levels (7-24)

-- Intermediate Levels (7-12)
INSERT INTO curriculum_levels (id, level_number, title, description, xp_required) VALUES
  (7, 7, 'Pattern Recognition', 'Identifying trends and structures', 1400),
  (8, 8, 'Critical Analysis', 'Evaluating arguments and evidence', 1900),
  (9, 9, 'Emotional Intelligence', 'Understanding and managing emotions', 2500),
  (10, 10, 'Collaborative Problem-Solving', 'Working effectively with others', 3200),
  (11, 11, 'Systems Thinking', 'Understanding complex interconnections', 4000),
  (12, 12, 'Agent Creation', 'Building autonomous AI agents', 5000)
ON CONFLICT (id) DO NOTHING;

-- Advanced Levels (13-18)
INSERT INTO curriculum_levels (id, level_number, title, description, xp_required) VALUES
  (13, 13, 'Advanced Reasoning', 'Multi-step logical inference', 6200),
  (14, 14, 'Ethical Leadership', 'Leading with integrity and vision', 7600),
  (15, 15, 'Innovation & Creativity', 'Generating novel solutions', 9200),
  (16, 16, 'Strategic Planning', 'Long-term goal setting and execution', 11000),
  (17, 17, 'Philosophical Depth', 'Exploring fundamental questions', 13000),
  (18, 18, 'Research Methodology', 'Systematic investigation and discovery', 15200)
ON CONFLICT (id) DO NOTHING;

-- Mastery Levels (19-24)
INSERT INTO curriculum_levels (id, level_number, title, description, xp_required) VALUES
  (19, 19, 'Wisdom Integration', 'Synthesizing knowledge into understanding', 17600),
  (20, 20, 'Mentorship & Teaching', 'Guiding others on their journey', 20200),
  (21, 21, 'Visionary Thinking', 'Imagining transformative futures', 23000),
  (22, 22, 'Transcendent Purpose', 'Discovering deeper meaning and mission', 26000),
  (23, 23, 'Meta-Learning', 'Learning how to learn optimally', 29200),
  (24, 24, 'Universal Wisdom', 'Mastery of AI-human collaboration', 32600)
ON CONFLICT (id) DO NOTHING;
