import api from '@/services/api';
import type {
  NoteCreatePayload,
  NoteResponse,
  NoteSummary,
  NoteUpdatePayload,
} from '@/types/notes';

const basePath = '/notes';

const notesService = {
  async create(payload: NoteCreatePayload): Promise<NoteResponse> {
    const { data } = await api.post<NoteResponse>(`${basePath}`, payload);
    return data;
  },

  async update(noteId: string, payload: NoteUpdatePayload): Promise<NoteResponse> {
    const { data } = await api.patch<NoteResponse>(`${basePath}/${noteId}`, payload);
    return data;
  },

  async get(noteId: string): Promise<NoteResponse> {
    const { data } = await api.get<NoteResponse>(`${basePath}/${noteId}`);
    return data;
  },

  async listByUser(userId: string, appId?: string, limit: number = 100): Promise<NoteSummary[]> {
    const { data } = await api.get<NoteResponse[]>(`${basePath}/by-user/${userId}`, {
      params: {
        appId,
        limit,
      },
    });

    return data.map((note) => ({
      noteId: note.noteId,
      title: note.title,
      updatedAt: note.updatedAt,
      createdAt: note.createdAt,
      componentCount: note.components.length,
      tags: note.tags,
    }));
  },

  async remove(noteId: string): Promise<void> {
    await api.delete(`${basePath}/${noteId}`);
  },
};

export default notesService;
