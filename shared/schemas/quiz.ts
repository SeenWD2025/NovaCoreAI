import { z } from "zod";

export const quizQuestionTypeEnum = z.enum([
  "MULTIPLE_CHOICE",
  "TRUE_FALSE",
  "SHORT_ANSWER",
  "WRITTEN_RESPONSE",
]);

export const difficultyEnum = z.enum(["INTRODUCTORY", "INTERMEDIATE", "ADVANCED"]);

const baseQuestionSchema = z.object({
  questionId: z.string().min(1),
  sourceComponentId: z.string().min(1).nullable().optional(),
  prompt: z.string().min(1),
  type: quizQuestionTypeEnum,
  difficulty: difficultyEnum.default("INTERMEDIATE"),
  tags: z.array(z.string()).default([]),
  points: z.number().nonnegative().default(1),
  rationale: z.string().optional(),
});

const answerOptionSchema = z.object({
  optionId: z.string().min(1),
  text: z.string().min(1),
  isCorrect: z.boolean(),
  rationale: z.string().optional(),
});

const multipleChoiceQuestionSchema = baseQuestionSchema.extend({
  type: z.literal("MULTIPLE_CHOICE"),
  options: z.array(answerOptionSchema).min(2),
  allowMultipleCorrect: z.boolean().default(false),
});

const trueFalseQuestionSchema = baseQuestionSchema.extend({
  type: z.literal("TRUE_FALSE"),
  answer: z.boolean(),
});

const shortAnswerQuestionSchema = baseQuestionSchema.extend({
  type: z.literal("SHORT_ANSWER"),
  acceptableAnswers: z.array(z.string().min(1)).min(1),
  evaluationMode: z.enum(["EXACT", "FUZZY", "LLM_ASSISTED"]).default("EXACT"),
});

const writtenResponseQuestionSchema = baseQuestionSchema.extend({
  type: z.literal("WRITTEN_RESPONSE"),
  rubric: z.string().min(1),
  suggestedWordCount: z.number().int().positive().optional(),
});

export const quizQuestionSchema = z.discriminatedUnion("type", [
  multipleChoiceQuestionSchema,
  trueFalseQuestionSchema,
  shortAnswerQuestionSchema,
  writtenResponseQuestionSchema,
]);

export const quizMetadataSchema = z.object({
  version: z.number().int().positive().default(1),
  generatedBy: z.enum(["GEMINI", "OPENAI", "OLLAMA", "HUMAN_OVERRIDE"]).optional(),
  generationTimestamp: z.string().datetime().optional(),
  sourceNoteSnapshotId: z.string().optional(),
});

export const quizSchema = z.object({
  quizId: z.string().min(1),
  userId: z.string().min(1),
  appId: z.string().min(1),
  noteId: z.string().min(1),
  questions: z.array(quizQuestionSchema).min(1),
  contextMarkdown: z.string().optional(),
  metadata: quizMetadataSchema.default(quizMetadataSchema.parse({})),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const quizSubmissionAnswerSchema = z.discriminatedUnion("type", [
  z.object({
    questionId: z.string().min(1),
    type: z.literal("MULTIPLE_CHOICE"),
    selectedOptionIds: z.array(z.string().min(1)).default([]),
  }),
  z.object({
    questionId: z.string().min(1),
    type: z.literal("TRUE_FALSE"),
    answer: z.boolean(),
  }),
  z.object({
    questionId: z.string().min(1),
    type: z.literal("SHORT_ANSWER"),
    answer: z.string().min(1),
  }),
  z.object({
    questionId: z.string().min(1),
    type: z.literal("WRITTEN_RESPONSE"),
    answer: z.string().min(1),
  }),
]);

export const quizSubmissionSchema = z.object({
  sessionId: z.string().min(1),
  quizId: z.string().min(1),
  userId: z.string().min(1),
  answers: z.array(quizSubmissionAnswerSchema),
  submittedAt: z.string().datetime(),
});

export const questionResultSchema = z.object({
  questionId: z.string().min(1),
  score: z.number().min(0),
  maxScore: z.number().positive(),
  feedback: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export const quizResultSchema = z.object({
  sessionId: z.string().min(1),
  quizId: z.string().min(1),
  userId: z.string().min(1),
  totalScore: z.number().min(0),
  maxScore: z.number().positive(),
  questionResults: z.array(questionResultSchema),
  completedAt: z.string().datetime(),
  recommendations: z.array(z.string()).default([]),
  noteImprovementSuggestions: z.array(z.string()).default([]),
});

export const reflectionFeedbackSchema = z.object({
  quizId: z.string().min(1),
  userId: z.string().min(1),
  quizRating: z.number().min(1).max(5),
  recommendationRating: z.number().min(1).max(5),
  notes: z.string().optional(),
  submittedAt: z.string().datetime(),
});

export type QuizQuestion = z.infer<typeof quizQuestionSchema>;
export type Quiz = z.infer<typeof quizSchema>;
export type QuizSubmission = z.infer<typeof quizSubmissionSchema>;
export type QuizResult = z.infer<typeof quizResultSchema>;
export type ReflectionFeedback = z.infer<typeof reflectionFeedbackSchema>;
