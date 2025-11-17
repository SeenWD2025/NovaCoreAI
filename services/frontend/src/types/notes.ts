export type NoteComponentType =
  | 'HEADER'
  | 'SUBJECT'
  | 'DEFINITION'
  | 'EXAMPLE'
  | 'EXPLANATION';

export interface NoteMetadata {
  source?: string | null;
  courseId?: string | null;
  curriculumPath?: string | null;
  extra?: Record<string, string>;
}

export interface NoteComponent {
  componentId: string;
  componentType: NoteComponentType;
  content: string;
  sequence: number;
  metadata: Record<string, string>;
}

export interface NoteBase {
  noteId: string;
  userId: string;
  appId: string;
  sessionId: string;
  title: string;
  components: NoteComponent[];
  tags: string[];
  retentionPolicyDays: number;
  quizGenerationRequested: boolean;
  metadata: NoteMetadata;
  isDeleted: boolean;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NoteCreatePayload {
  userId: string;
  appId: string;
  sessionId: string;
  title: string;
  components: NoteComponent[];
  tags: string[];
  retentionPolicyDays: number;
  quizGenerationRequested: boolean;
  metadata: NoteMetadata;
}

export type NoteUpdatePayload = Partial<Omit<NoteCreatePayload, 'userId' | 'appId' | 'sessionId'>> & {
  components?: NoteComponent[];
  tags?: string[];
};

export type NoteResponse = NoteBase;

export interface NoteSummary {
  noteId: string;
  title: string;
  updatedAt: string;
  createdAt: string;
  componentCount: number;
  tags: string[];
}
