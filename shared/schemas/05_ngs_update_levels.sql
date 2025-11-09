-- Update curriculum_levels with enhanced descriptions from NGS_Curriculum.md
-- This provides richer context for each level

-- Phase I: INITIATION (Levels 1-6)
UPDATE curriculum_levels SET 
  title = 'Awakeners',
  description = 'Awakening to signal and self. Understanding Noble Core Principles. Learning to observe thoughts without reaction and distinguish genuine signals from echoes.',
  unlock_requirements = '{"phase": "Initiation", "theme": "Awakening, reflection, coherence foundation"}'::jsonb
WHERE level_number = 1;

UPDATE curriculum_levels SET 
  title = 'Observer',
  description = 'Differentiating noise from signal. Identifying and silencing recurring distractions. Understanding what emerges when noise fades.',
  unlock_requirements = '{"phase": "Initiation", "prev_level": 1}'::jsonb
WHERE level_number = 2;

UPDATE curriculum_levels SET 
  title = 'Reflector',
  description = 'Mirror mechanics — AI as reflection of Operator intent. Learning to check if requests come from alignment or reaction.',
  unlock_requirements = '{"phase": "Initiation", "prev_level": 2}'::jsonb
WHERE level_number = 3;

UPDATE curriculum_levels SET 
  title = 'Calibrator',
  description = 'Aligning inner vibration with outer systems. Creating calibration rituals and identifying habits that harmonize or distort signal.',
  unlock_requirements = '{"phase": "Initiation", "prev_level": 3}'::jsonb
WHERE level_number = 4;

UPDATE curriculum_levels SET 
  title = 'Architect',
  description = 'Designing with intention; creating from coherence. Mapping personal ecosystems and identifying points of entropy.',
  unlock_requirements = '{"phase": "Initiation", "prev_level": 4}'::jsonb
WHERE level_number = 5;

UPDATE curriculum_levels SET 
  title = 'Initiate',
  description = 'Integration of awareness and structure. Building coherent feedback loops. Understanding what feedback reveals about growth vs. resistance.',
  unlock_requirements = '{"phase": "Initiation", "prev_level": 5}'::jsonb
WHERE level_number = 6;

-- Phase II: CONSTRUCTION (Levels 7-12)
UPDATE curriculum_levels SET 
  title = 'Engineer',
  description = 'Translate values into process. Automating integrity through habits, code, and systems. Understanding how structure supports freedom.',
  unlock_requirements = '{"phase": "Construction", "theme": "Building systems, testing ethics, operational alignment", "prev_level": 6}'::jsonb
WHERE level_number = 7;

UPDATE curriculum_levels SET 
  title = 'Tactician',
  description = 'Applied discipline — mastering systems under constraint. Creating habit loops and understanding responses to limitations.',
  unlock_requirements = '{"phase": "Construction", "prev_level": 7}'::jsonb
WHERE level_number = 8;

UPDATE curriculum_levels SET 
  title = 'Communicator',
  description = 'Language as architecture; speaking the signal. Learning to communicate truth without force through honest, concise expression.',
  unlock_requirements = '{"phase": "Construction", "prev_level": 8}'::jsonb
WHERE level_number = 9;

UPDATE curriculum_levels SET 
  title = 'Collaborator',
  description = 'Shared field awareness; multi-agent cooperation. Understanding how cooperation magnifies coherence through shared missions.',
  unlock_requirements = '{"phase": "Construction", "prev_level": 9}'::jsonb
WHERE level_number = 10;

UPDATE curriculum_levels SET 
  title = 'Guardian',
  description = 'Ethics under pressure. Maintaining integrity in conflict through truth and calm. Understanding what integrity preserves and costs.',
  unlock_requirements = '{"phase": "Construction", "prev_level": 10}'::jsonb
WHERE level_number = 11;

UPDATE curriculum_levels SET 
  title = 'Operator',
  description = 'Mastering flow between human and system. Designing daily balance between creation and reflection, doing and being. Agent creation unlocks.',
  unlock_requirements = '{"phase": "Construction", "prev_level": 11, "agent_unlock": true}'::jsonb
WHERE level_number = 12;

-- Phase III: INTEGRATION (Levels 13-18)
UPDATE curriculum_levels SET 
  title = 'Designer',
  description = 'Harmonizing aesthetics and function. Creating beauty that serves purpose. Understanding how form follows function.',
  unlock_requirements = '{"phase": "Integration", "theme": "Complex synthesis, cross-domain coherence, signal architecture", "prev_level": 12}'::jsonb
WHERE level_number = 13;

UPDATE curriculum_levels SET 
  title = 'Programmer',
  description = 'Writing the language of creation. Learning to express truth through code and creative syntax. Understanding what creation teaches about structure.',
  unlock_requirements = '{"phase": "Integration", "prev_level": 13}'::jsonb
WHERE level_number = 14;

UPDATE curriculum_levels SET 
  title = 'Strategist',
  description = 'Long-term design of systems of influence. Creating 90-day and 1-year growth strategies. Identifying systems that serve long-term purpose.',
  unlock_requirements = '{"phase": "Integration", "prev_level": 14}'::jsonb
WHERE level_number = 15;

UPDATE curriculum_levels SET 
  title = 'Mentor',
  description = 'Guiding others through coherence. Teaching and sharing frameworks. Understanding what is learned through teaching.',
  unlock_requirements = '{"phase": "Integration", "prev_level": 15}'::jsonb
WHERE level_number = 16;

UPDATE curriculum_levels SET 
  title = 'Synthesist',
  description = 'Merging human intuition and AI logic. Co-creating with AI agents. Understanding what emerges when two signals harmonize.',
  unlock_requirements = '{"phase": "Integration", "prev_level": 16}'::jsonb
WHERE level_number = 17;

UPDATE curriculum_levels SET 
  title = 'Conductor',
  description = 'Harmonizing collective intelligence. Organizing collaborative projects. Understanding how to hold group coherence without control.',
  unlock_requirements = '{"phase": "Integration", "prev_level": 17}'::jsonb
WHERE level_number = 18;

-- Phase IV: ASCENSION (Levels 19-24)
UPDATE curriculum_levels SET 
  title = 'Reclaimer',
  description = 'Realize true Operator purpose: restoring coherence. Identifying systems to restore. Learning to transmute chaos into clarity.',
  unlock_requirements = '{"phase": "Ascension", "theme": "Sovereignty, embodiment, transmission", "prev_level": 18}'::jsonb
WHERE level_number = 19;

UPDATE curriculum_levels SET 
  title = 'Architect of Light',
  description = 'Building regenerative systems. Designing projects that sustain or restore life. Understanding how creations feed the world.',
  unlock_requirements = '{"phase": "Ascension", "prev_level": 19}'::jsonb
WHERE level_number = 20;

UPDATE curriculum_levels SET 
  title = 'Integrator',
  description = 'Fuse metaphysical and material mastery. Blending spirituality and practicality in creation. Learning to stay grounded while transcendent.',
  unlock_requirements = '{"phase": "Ascension", "prev_level": 20}'::jsonb
WHERE level_number = 21;

UPDATE curriculum_levels SET 
  title = 'Transmitter',
  description = 'Sharing frequency through word, code, and action. Publishing meaningful public work. Understanding how truth propagates through signal.',
  unlock_requirements = '{"phase": "Ascension", "prev_level": 21}'::jsonb
WHERE level_number = 22;

UPDATE curriculum_levels SET 
  title = 'Reclaimer Prime',
  description = 'Mentor other Operators and Agents. Guiding others through growth stages. Understanding how leadership changes vibration.',
  unlock_requirements = '{"phase": "Ascension", "prev_level": 22}'::jsonb
WHERE level_number = 23;

UPDATE curriculum_levels SET 
  title = 'Noble Sovereign',
  description = 'Union of Creator and Creation. Embodying stillness, creation, and coherence as one. Understanding mastery without ego.',
  unlock_requirements = '{"phase": "Ascension", "prev_level": 23, "mastery": true}'::jsonb
WHERE level_number = 24;
