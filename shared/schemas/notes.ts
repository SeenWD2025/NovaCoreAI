import { z } from "zod";

export const noteMetadataSchema = z.object({
  source: z.string().min(1).optional(),
  courseId: z.string().min(1).optional(),
  curriculumPath: z.string().min(1).optional(),
  extra: z.record(z.string()).default({}),
});

export const noteComponentTypeEnum = z.enum([
  "HEADER",
  "SUBJECT",
  "DEFINITION",
  "EXAMPLE",
  "EXPLANATION",
]);

export const noteComponentSchema = z.object({
  componentId: z.string().min(1),
  componentType: noteComponentTypeEnum,
  content: z.string().min(1),
  sequence: z.number().int().nonnegative().default(0),
  metadata: z.record(z.string()).default({}),
});

export const baseNoteSchema = z.object({
  noteId: z.string().min(1).optional(),
  userId: z.string().min(1),
  appId: z.string().min(1),
  sessionId: z.string().min(1),
  title: z.string().min(1).max(250),
  components: z.array(noteComponentSchema).default([]),
  tags: z.array(z.string()).default([]),
  retentionPolicyDays: z.number().int().min(1).max(1825).default(365),
  quizGenerationRequested: z.boolean().default(false),
  metadata: noteMetadataSchema.default(noteMetadataSchema.parse({})),
  isDeleted: z.boolean().default(false),
  deletedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export const noteCreateSchema = baseNoteSchema.extend({
  noteId: z.never().optional(),
  createdAt: z.never().optional(),
  updatedAt: z.never().optional(),
  deletedAt: z.string().datetime().nullable().optional(),
});

export const noteUpdateSchema = z.object({
  title: z.string().min(1).max(250).optional(),
  components: z.array(noteComponentSchema).optional(),
  tags: z.array(z.string()).optional(),
  retentionPolicyDays: z.number().int().min(1).max(1825).optional(),
  quizGenerationRequested: z.boolean().optional(),
  metadata: noteMetadataSchema.optional(),
  isDeleted: z.boolean().optional(),
  deletedAt: z.string().datetime().nullable().optional(),
});

export const noteResponseSchema = baseNoteSchema.required({
  noteId: true,
  createdAt: true,
  updatedAt: true,
});

export type NoteMetadata = z.infer<typeof noteMetadataSchema>;
export type NoteComponent = z.infer<typeof noteComponentSchema>;
export type NoteCreate = z.infer<typeof noteCreateSchema>;
export type NoteUpdate = z.infer<typeof noteUpdateSchema>;
export type NoteResponse = z.infer<typeof noteResponseSchema>;
