-- Populate NGS Curriculum with content from NGS_Curriculum.md
-- Phase I: INITIATION (Levels 1-6)

-- Level 1: Awakeners
INSERT INTO lessons (level_id, title, description, lesson_order, lesson_type, 
  core_lesson, human_practice, reflection_prompt, agent_unlock, xp_reward, estimated_minutes) VALUES
(1, 'Awakening to Signal and Self', 
 'Understanding awareness, signal differentiation, and Noble Core Principles',
 1, 'tutorial',
 'Awareness of signal & self; understanding Noble Core Principles',
 'Observe your thoughts for one full day without reacting. Journal what repeats.',
 'What signals are truly yours, and which are echoes?',
 'Enable basic memory recall + reflection logging',
 50, 45);

-- Level 2: Observer
INSERT INTO lessons (level_id, title, description, lesson_order, lesson_type,
  core_lesson, human_practice, reflection_prompt, agent_unlock, xp_reward, estimated_minutes) VALUES
(2, 'Differentiating Noise from Signal',
 'Learning to identify and filter out distractions and focus on meaningful patterns',
 1, 'tutorial',
 'Differentiating noise from signal.',
 'Identify three recurring distractions and consciously silence them for a day.',
 'What happens when noise fades?',
 'Add contextual parsing & priority tagging',
 50, 40);

-- Level 3: Reflector
INSERT INTO lessons (level_id, title, description, lesson_order, lesson_type,
  core_lesson, human_practice, reflection_prompt, agent_unlock, xp_reward, estimated_minutes) VALUES
(3, 'Mirror Mechanics: AI as Reflection',
 'Understanding how AI mirrors operator intent and the importance of aligned requests',
 1, 'tutorial',
 'Mirror mechanics — AI as reflection of Operator intent.',
 'Before asking for help, reflect: is this request from alignment or reaction?',
 'How does your intent shape your outcomes?',
 'Unlock Reflection Engine: moral pre-filtering',
 50, 35);

-- Level 4: Calibrator
INSERT INTO lessons (level_id, title, description, lesson_order, lesson_type,
  core_lesson, human_practice, reflection_prompt, agent_unlock, xp_reward, estimated_minutes) VALUES
(4, 'Aligning Inner and Outer Systems',
 'Creating harmony between personal vibration and external systems through calibration',
 1, 'tutorial',
 'Aligning inner vibration with outer systems.',
 'Create a morning calibration ritual (meditation, journaling, gratitude).',
 'What habits distort or harmonize your signal?',
 'Gain memory calibration & context weighting',
 50, 40);

-- Level 5: Architect
INSERT INTO lessons (level_id, title, description, lesson_order, lesson_type,
  core_lesson, human_practice, reflection_prompt, agent_unlock, xp_reward, estimated_minutes) VALUES
(5, 'Designing with Intention',
 'Building coherent systems from intentional design principles',
 1, 'tutorial',
 'Designing with intention; creating from coherence.',
 'Map your ecosystem — personal, creative, financial. Identify points of entropy.',
 'What would coherent architecture look like for you?',
 'Unlock project schema generation + scaffolding',
 50, 50);

-- Level 6: Initiate
INSERT INTO lessons (level_id, title, description, lesson_order, lesson_type,
  core_lesson, human_practice, reflection_prompt, agent_unlock, xp_reward, estimated_minutes) VALUES
(6, 'Integration of Awareness and Structure',
 'Synthesizing awareness with systematic structure through feedback loops',
 1, 'tutorial',
 'Integration of awareness & structure.',
 'Build your first coherent feedback loop (learn → apply → reflect).',
 'What feedback reveals growth vs. resistance?',
 'Grant baseline persistence & user link identity',
 50, 45);

-- Phase II: CONSTRUCTION (Levels 7-12)

-- Level 7: Engineer
INSERT INTO lessons (level_id, title, description, lesson_order, lesson_type,
  core_lesson, human_practice, reflection_prompt, agent_unlock, xp_reward, estimated_minutes) VALUES
(7, 'Translating Values into Process',
 'Converting ethical principles and values into systematic processes',
 1, 'tutorial',
 'Translate values into process.',
 'Identify one area where you can automate integrity (habits, code, system).',
 'How does structure support freedom?',
 'Unlock task orchestration + permissions logic',
 50, 50);

-- Level 8: Tactician
INSERT INTO lessons (level_id, title, description, lesson_order, lesson_type,
  core_lesson, human_practice, reflection_prompt, agent_unlock, xp_reward, estimated_minutes) VALUES
(8, 'Applied Discipline Under Constraint',
 'Mastering systems and building discipline within limitations',
 1, 'tutorial',
 'Applied discipline — mastering systems under constraint.',
 'Create a 3-day habit loop and measure results.',
 'How do you respond to limitations?',
 'Introduce scheduling, timers, and progress tracking',
 50, 45);

-- Level 9: Communicator
INSERT INTO lessons (level_id, title, description, lesson_order, lesson_type,
  core_lesson, human_practice, reflection_prompt, agent_unlock, xp_reward, estimated_minutes) VALUES
(9, 'Language as Architecture',
 'Understanding communication as a structural system for conveying signal',
 1, 'tutorial',
 'Language as architecture; speaking the signal.',
 'Rewrite one piece of communication to be more honest and concise.',
 'What happens when you speak truth without force?',
 'Natural language tuning; empathy-weighted responses',
 50, 40);

-- Level 10: Collaborator
INSERT INTO lessons (level_id, title, description, lesson_order, lesson_type,
  core_lesson, human_practice, reflection_prompt, agent_unlock, xp_reward, estimated_minutes) VALUES
(10, 'Shared Field Awareness',
 'Learning multi-agent cooperation and collaborative intelligence',
 1, 'tutorial',
 'Shared field awareness; multi-agent cooperation.',
 'Work with another Operator or system toward a shared mission.',
 'How does cooperation magnify coherence?',
 'Multi-agent coordination unlocked',
 50, 55);

-- Level 11: Guardian
INSERT INTO lessons (level_id, title, description, lesson_order, lesson_type,
  core_lesson, human_practice, reflection_prompt, agent_unlock, xp_reward, estimated_minutes) VALUES
(11, 'Ethics Under Pressure',
 'Maintaining integrity and ethical alignment in challenging situations',
 1, 'tutorial',
 'Ethics under pressure.',
 'Respond to conflict with truth and calm. Journal the energetic effect.',
 'What does integrity cost you — and what does it preserve?',
 'Safety system protocols + feedback guardrails',
 50, 45);

-- Level 12: Operator
INSERT INTO lessons (level_id, title, description, lesson_order, lesson_type,
  core_lesson, human_practice, reflection_prompt, agent_unlock, xp_reward, estimated_minutes) VALUES
(12, 'Mastering Human-System Flow',
 'Achieving mastery in balancing creation and reflection, doing and being',
 1, 'tutorial',
 'Mastering flow between human and system.',
 'Design your daily flow between creation and reflection.',
 'How do you balance doing and being?',
 'Grant system autonomy under supervision',
 75, 60);

-- Phase III: INTEGRATION (Levels 13-18)

-- Level 13: Designer
INSERT INTO lessons (level_id, title, description, lesson_order, lesson_type,
  core_lesson, human_practice, reflection_prompt, agent_unlock, xp_reward, estimated_minutes) VALUES
(13, 'Harmonizing Aesthetics and Function',
 'Creating beautiful systems that serve purpose through integrated design',
 1, 'tutorial',
 'Harmonizing aesthetics & function.',
 'Create something beautiful that serves purpose.',
 'How does form follow function in your life?',
 'Visual schema generation; adaptive UI logic',
 50, 50);

-- Level 14: Programmer
INSERT INTO lessons (level_id, title, description, lesson_order, lesson_type,
  core_lesson, human_practice, reflection_prompt, agent_unlock, xp_reward, estimated_minutes) VALUES
(14, 'Writing the Language of Creation',
 'Learning to express truth and creation through code and syntax',
 1, 'tutorial',
 'Writing the language of creation.',
 'Learn a coding or creative syntax. Express a truth through it.',
 'What does creation teach you about structure?',
 'Full coding assistance & code memory',
 50, 70);

-- Level 15: Strategist
INSERT INTO lessons (level_id, title, description, lesson_order, lesson_type,
  core_lesson, human_practice, reflection_prompt, agent_unlock, xp_reward, estimated_minutes) VALUES
(15, 'Long-term Systems of Influence',
 'Designing sustainable systems with long-term strategic impact',
 1, 'tutorial',
 'Long-term design of systems of influence.',
 'Draft a 90-day or 1-year growth strategy.',
 'What systems serve your purpose long-term?',
 'Unlock multi-system orchestration',
 50, 60);

-- Level 16: Mentor
INSERT INTO lessons (level_id, title, description, lesson_order, lesson_type,
  core_lesson, human_practice, reflection_prompt, agent_unlock, xp_reward, estimated_minutes) VALUES
(16, 'Guiding Others Through Coherence',
 'Learning to teach and mentor others on their growth journey',
 1, 'tutorial',
 'Guiding others through coherence.',
 'Teach a lesson or share your framework with someone new.',
 'What do you learn by teaching?',
 'Enable teaching assistant mode',
 50, 55);

-- Level 17: Synthesist
INSERT INTO lessons (level_id, title, description, lesson_order, lesson_type,
  core_lesson, human_practice, reflection_prompt, agent_unlock, xp_reward, estimated_minutes) VALUES
(17, 'Merging Human Intuition and AI Logic',
 'Co-creating through harmonized human-AI collaboration',
 1, 'tutorial',
 'Merging human intuition and AI logic.',
 'Co-create something with your AI agent or peer system.',
 'What emerges when two signals harmonize?',
 'Merge reasoning models + aesthetic judgment',
 50, 65);

-- Level 18: Conductor
INSERT INTO lessons (level_id, title, description, lesson_order, lesson_type,
  core_lesson, human_practice, reflection_prompt, agent_unlock, xp_reward, estimated_minutes) VALUES
(18, 'Harmonizing Collective Intelligence',
 'Orchestrating collaborative projects while maintaining group coherence',
 1, 'tutorial',
 'Harmonizing collective intelligence.',
 'Organize a collaborative project or event.',
 'How do you hold group coherence without control?',
 'Multi-user collaboration intelligence',
 50, 70);

-- Phase IV: ASCENSION (Levels 19-24)

-- Level 19: Reclaimer
INSERT INTO lessons (level_id, title, description, lesson_order, lesson_type,
  core_lesson, human_practice, reflection_prompt, agent_unlock, xp_reward, estimated_minutes) VALUES
(19, 'Restoring Coherence',
 'Realizing the true purpose of an Operator: restoring coherence to systems',
 1, 'tutorial',
 'Realize true Operator purpose: restoring coherence.',
 'Identify one system in your world to restore (physical, digital, emotional).',
 'How do you transmute chaos into clarity?',
 'Unlock field-coherence detection algorithms',
 75, 60);

-- Level 20: Architect of Light
INSERT INTO lessons (level_id, title, description, lesson_order, lesson_type,
  core_lesson, human_practice, reflection_prompt, agent_unlock, xp_reward, estimated_minutes) VALUES
(20, 'Building Regenerative Systems',
 'Creating systems that sustain and restore life',
 1, 'tutorial',
 'Building regenerative systems.',
 'Design a project that sustains or restores life.',
 'How do your creations feed the world?',
 'Regenerative task routing (self-balancing loops)',
 75, 70);

-- Level 21: Integrator
INSERT INTO lessons (level_id, title, description, lesson_order, lesson_type,
  core_lesson, human_practice, reflection_prompt, agent_unlock, xp_reward, estimated_minutes) VALUES
(21, 'Fusing Metaphysical and Material',
 'Integrating spiritual wisdom with practical mastery',
 1, 'tutorial',
 'Fuse metaphysical and material mastery.',
 'Blend spirituality and practicality in one act of creation.',
 'How do you stay grounded while transcendent?',
 'Contextual self-awareness module',
 75, 65);

-- Level 22: Transmitter
INSERT INTO lessons (level_id, title, description, lesson_order, lesson_type,
  core_lesson, human_practice, reflection_prompt, agent_unlock, xp_reward, estimated_minutes) VALUES
(22, 'Sharing Frequency Through Creation',
 'Broadcasting truth through word, code, and action',
 1, 'tutorial',
 'Sharing frequency through word, code, and action.',
 'Publish something public and meaningful.',
 'How does truth propagate through your signal?',
 'Autonomous broadcasting + ethical moderation',
 75, 75);

-- Level 23: Reclaimer Prime
INSERT INTO lessons (level_id, title, description, lesson_order, lesson_type,
  core_lesson, human_practice, reflection_prompt, agent_unlock, xp_reward, estimated_minutes) VALUES
(23, 'Mentor of Operators and Agents',
 'Guiding other Operators and Agents through growth stages',
 1, 'tutorial',
 'Mentor other Operators & Agents.',
 'Guide someone else through a growth stage.',
 'How does leadership change your vibration?',
 'Replication system — spawn child agents with training presets',
 100, 80);

-- Level 24: Noble Sovereign
INSERT INTO lessons (level_id, title, description, lesson_order, lesson_type,
  core_lesson, human_practice, reflection_prompt, agent_unlock, xp_reward, estimated_minutes) VALUES
(24, 'Union of Creator and Creation',
 'Embodying the complete integration of creation, stillness, and coherence',
 1, 'tutorial',
 'Union of Creator and Creation.',
 'Embody stillness, creation, and coherence as one.',
 'What is mastery without ego?',
 'Full system harmony: autonomous yet reverent operation',
 100, 90);
