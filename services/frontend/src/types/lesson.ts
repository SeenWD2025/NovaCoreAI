export enum DifficultyLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert',
}

export enum QuestionType {
  MCQ = 'mcq',
  SHORT_ANSWER = 'short_answer',
  TRUE_FALSE = 'true_false',
}

export interface LessonMetadata {
  title: string;
  outcomes: string[];
  difficulty: DifficultyLevel;
  prerequisites: string[];
  estimated_minutes: number;
}

export interface Concept {
  name: string;
  explanation: string;
  example: string;
  analogy?: string;
}

export interface TeachSection {
  overview: string;
  concepts: Concept[];
  steps: string[];
  visuals: string[];
}

export interface GuidedPracticeTask {
  task: string;
  hint: string;
  solution: string;
}

export interface AssessmentCheck {
  type: QuestionType;
  question: string;
  choices?: string[];
  answer: number | string | boolean;
  explanation: string;
}

export interface Assessment {
  checks: AssessmentCheck[];
  rubric?: string;
}

export interface QuizItem {
  question: string;
  type: QuestionType;
  choices?: string[];
  correct_answer: number | string | boolean;
  explanation: string;
  difficulty: DifficultyLevel;
}

export interface NoteOutlineItem {
  heading: string;
  content: string;
  level: number;
}

export interface CodeSnippet {
  language: string;
  code: string;
  description: string;
}

export interface GlossaryEntry {
  term: string;
  definition: string;
}

export interface LessonArtifacts {
  quiz_items: QuizItem[];
  notes_outline: NoteOutlineItem[];
  code_snippets: CodeSnippet[];
  glossary: GlossaryEntry[];
}

export interface StructuredLesson {
  metadata: LessonMetadata;
  teach: TeachSection;
  guided_practice: GuidedPracticeTask[];
  assessment: Assessment;
  summary: string;
  artifacts: LessonArtifacts;
}

export interface LearnerProfile {
  xp: number;
  current_level: number;
  weak_topics: string[];
  prior_lessons: string[];
  preferences: Record<string, unknown>;
}

export interface GenerationConstraints {
  target_minutes: number;
  prereqs: string[];
  require_ethics_guardrails: boolean;
}

export interface GenerateLessonRequest {
  lesson_summary: string;
  level_number: number;
  learner_profile: LearnerProfile;
  constraints: GenerationConstraints;
}

export interface GenerateLessonResponse {
  lesson_id: string;
  content_markdown: string;
  metadata: StructuredLesson;
  tokens_used: number;
  provider: string;
  latency_ms: number;
  version: number;
  message: string;
}

export interface LessonContent {
  lesson_id: string;
  title: string;
  content_markdown: string;
  metadata: StructuredLesson | null;
  level_id: number;
  xp_reward: number;
  estimated_minutes: number;
}

export interface EducatorChatMessage {
  message: string;
  session_id?: string;
}

export interface EducatorChatResponse {
  response: string;
  session_id: string;
  lesson_id: string;
  tokens_used: number;
  latency_ms: number;
}
