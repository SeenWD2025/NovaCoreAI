import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FilePlus, Notebook, PenSquare, Sparkles } from 'lucide-react';
import { useNotesStore } from '@/stores/useNotesStore';
import { useAuthStore } from '@/stores/authStore';
import { useQuizStore } from '@/stores/useQuizStore';

export default function Study() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const resetSession = useQuizStore((state) => state.resetSession);
  const notes = useNotesStore((state) => state.notes);
  const isLoading = useNotesStore((state) => state.isLoading);
  const error = useNotesStore((state) => state.error);
  const fetchNotes = useNotesStore((state) => state.fetchNotes);

  useEffect(() => {
    if (!user) {
      return;
    }
    fetchNotes();
  }, [user, fetchNotes]);

  const handleCreate = () => {
    navigate('/notes/new');
  };

  const handleEdit = (noteId: string) => {
    navigate(`/notes/${noteId}/edit`);
  };

  const handleQuiz = (noteId: string) => {
    resetSession();
    navigate(`/quiz/${noteId}`);
  };

  const renderEmptyState = () => (
    <div className="card text-center space-y-4">
      <div className="flex justify-center">
        <Notebook className="h-12 w-12 text-primary-500" />
      </div>
      <h2 className="text-xl font-semibold text-gray-900">Create your first study note</h2>
      <p className="text-gray-600">
        Structured notes power personalised quizzes and recommendations. Build one to get started.
      </p>
      <button type="button" className="btn-primary" onClick={handleCreate}>
        <FilePlus className="h-4 w-4 mr-2 inline" /> New Note
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Study Workspace</h1>
          <p className="text-gray-600">
            Manage structured notes and launch adaptive quizzes to reinforce key concepts.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={handleCreate}>
          <FilePlus className="h-4 w-4 mr-2 inline" /> New Note
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="card">
          <p className="text-gray-600">Loading notes...</p>
        </div>
      )}

      {!isLoading && notes.length === 0 && renderEmptyState()}

      {!isLoading && notes.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {notes.map((note) => (
            <div key={note.noteId} className="card space-y-4 border border-gray-200">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{note.title}</h2>
                <p className="text-sm text-gray-500">
                  Updated {new Date(note.updatedAt).toLocaleString()} • {note.componentCount} components
                </p>
                {note.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {note.tags.map((tag) => (
                      <span key={tag} className="badge-secondary">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => handleEdit(note.noteId)}
                >
                  <PenSquare className="h-4 w-4 mr-2 inline" /> Edit
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => handleQuiz(note.noteId)}
                >
                  <Sparkles className="h-4 w-4 mr-2 inline" /> Start Quiz
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
