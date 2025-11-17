import { create } from 'zustand';
import axios from 'axios';
import notesService from '@/services/notes';
import { useAuthStore } from '@/stores/authStore';
import {
  APP_ID,
  DEFAULT_NOTE_RETENTION_DAYS,
  DEFAULT_NOTE_SESSION_ID,
} from '@/config/appConfig';
import type {
  NoteCreatePayload,
  NoteResponse,
  NoteSummary,
  NoteUpdatePayload,
} from '@/types/notes';
import { showError, showSuccess } from '@/utils/toast';

interface NotesState {
  notes: NoteSummary[];
  currentNote: NoteResponse | null;
  isLoading: boolean;
  error: string | null;
  fetchNotes: () => Promise<void>;
  loadNote: (noteId: string) => Promise<NoteResponse | null>;
  createNote: (payload: {
    title: string;
    components: NoteCreatePayload['components'];
    tags: string[];
    metadata?: NoteCreatePayload['metadata'];
    quizGenerationRequested?: boolean;
  }) => Promise<NoteResponse | null>;
  updateNote: (noteId: string, payload: NoteUpdatePayload) => Promise<NoteResponse | null>;
  deleteNote: (noteId: string) => Promise<void>;
  clearCurrentNote: () => void;
}

const defaultMetadata: NoteCreatePayload['metadata'] = {
  source: 'note-builder',
  courseId: null,
  curriculumPath: null,
  extra: {},
};

export const useNotesStore = create<NotesState>((set, get) => ({
  notes: [],
  currentNote: null,
  isLoading: false,
  error: null,

  fetchNotes: async () => {
    const user = useAuthStore.getState().user;
    if (!user) {
      set({ notes: [], error: 'You must be signed in to load notes.' });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const notes = (await notesService.listByUser(user.id, APP_ID)).sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt)
      );
      set({ notes, isLoading: false });
    } catch (error: unknown) {
      let message = 'Failed to load notes.';
      if (axios.isAxiosError(error)) {
        message = error.response?.data?.detail || error.response?.data?.message || message;
      } else if (error instanceof Error && error.message) {
        message = error.message;
      }
      showError(message);
      set({ isLoading: false, error: message });
    }
  },

  loadNote: async (noteId: string) => {
    set({ isLoading: true, error: null });
    try {
      const note = await notesService.get(noteId);
      set({ currentNote: note, isLoading: false });
      return note;
    } catch (error: unknown) {
      let message = 'Failed to load note.';
      if (axios.isAxiosError(error)) {
        message = error.response?.data?.detail || error.response?.data?.message || message;
      } else if (error instanceof Error && error.message) {
        message = error.message;
      }
      showError(message);
      set({ isLoading: false, error: message, currentNote: null });
      return null;
    }
  },

  createNote: async ({
    title,
    components,
    tags,
    metadata,
    quizGenerationRequested = false,
  }) => {
    const user = useAuthStore.getState().user;
    if (!user) {
      showError('You must be signed in to create a note.');
      return null;
    }

    set({ isLoading: true, error: null });
    const metadataPayload = metadata ?? defaultMetadata;

    const payload: NoteCreatePayload = {
      userId: user.id,
      appId: APP_ID,
      sessionId: DEFAULT_NOTE_SESSION_ID,
      title,
      components,
      tags,
      retentionPolicyDays: DEFAULT_NOTE_RETENTION_DAYS,
      quizGenerationRequested,
      metadata: {
        source: metadataPayload.source ?? defaultMetadata.source ?? 'note-builder',
        courseId: metadataPayload.courseId ?? null,
        curriculumPath: metadataPayload.curriculumPath ?? null,
        extra: { ...(metadataPayload.extra ?? {}) },
      },
    };

    try {
      const note = await notesService.create(payload);
      const notes = [...get().notes.filter((existing) => existing.noteId !== note.noteId), {
        noteId: note.noteId,
        title: note.title,
        updatedAt: note.updatedAt,
        createdAt: note.createdAt,
        componentCount: note.components.length,
        tags: note.tags,
      }].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

      set({ currentNote: note, notes, isLoading: false });
      showSuccess('Note saved successfully.');
      return note;
    } catch (error: unknown) {
      let message = 'Failed to save note.';
      if (axios.isAxiosError(error)) {
        message = error.response?.data?.detail || error.response?.data?.message || message;
      } else if (error instanceof Error && error.message) {
        message = error.message;
      }
      showError(message);
      set({ isLoading: false, error: message });
      return null;
    }
  },

  updateNote: async (noteId: string, payload: NoteUpdatePayload) => {
    set({ isLoading: true, error: null });
    try {
      const note = await notesService.update(noteId, payload);
      const notes = [...get().notes.filter((existing) => existing.noteId !== note.noteId), {
        noteId: note.noteId,
        title: note.title,
        updatedAt: note.updatedAt,
        createdAt: note.createdAt,
        componentCount: note.components.length,
        tags: note.tags,
      }].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

      set({ currentNote: note, notes, isLoading: false });
      showSuccess('Note updated successfully.');
      return note;
    } catch (error: unknown) {
      let message = 'Failed to update note.';
      if (axios.isAxiosError(error)) {
        message = error.response?.data?.detail || error.response?.data?.message || message;
      } else if (error instanceof Error && error.message) {
        message = error.message;
      }
      showError(message);
      set({ isLoading: false, error: message });
      return null;
    }
  },

  deleteNote: async (noteId: string) => {
    set({ isLoading: true, error: null });
    try {
      await notesService.remove(noteId);
      const notes = get().notes.filter((note) => note.noteId !== noteId);
      set({ notes, isLoading: false });
      showSuccess('Note deleted.');
    } catch (error: unknown) {
      let message = 'Failed to delete note.';
      if (axios.isAxiosError(error)) {
        message = error.response?.data?.detail || error.response?.data?.message || message;
      } else if (error instanceof Error && error.message) {
        message = error.message;
      }
      showError(message);
      set({ isLoading: false, error: message });
    }
  },

  clearCurrentNote: () => set({ currentNote: null }),
}));
