import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  PlusCircle,
  Save,
  ScrollText,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { showError } from '@/utils/toast';
import { useNotesStore } from '@/stores/useNotesStore';
import { useQuizStore } from '@/stores/useQuizStore';
import type { NoteComponentType } from '@/types/notes';

interface EditableComponent {
  componentId: string;
  componentType: NoteComponentType;
  content: string;
  metadata: Record<string, string>;
}

const COMPONENT_OPTIONS: { value: NoteComponentType; label: string; helper: string }[] = [
  { value: 'HEADER', label: 'Header', helper: 'High-level section heading' },
  { value: 'SUBJECT', label: 'Subject', helper: 'Topic or concept name' },
  { value: 'DEFINITION', label: 'Definition', helper: 'Concise description or definition' },
  { value: 'EXAMPLE', label: 'Example', helper: 'Illustrative example or scenario' },
  { value: 'EXPLANATION', label: 'Explanation', helper: 'Detailed explanation or notes' },
];

const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `component-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export default function NoteBuilder() {
  const navigate = useNavigate();
  const params = useParams();
  const noteId = params.noteId;
  const isEditing = Boolean(noteId);

  const {
    currentNote,
    isLoading,
    createNote,
    updateNote,
    loadNote,
    clearCurrentNote,
  } = useNotesStore();

  const { resetSession } = useQuizStore();

  const [title, setTitle] = useState('');
  const [tags, setTags] = useState<string>('');
  const [components, setComponents] = useState<EditableComponent[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      clearCurrentNote();
      return;
    }

    loadNote(noteId!).then((note) => {
      if (!note) {
        navigate('/study');
      }
    });
  }, [isEditing, loadNote, noteId, navigate, clearCurrentNote]);

  useEffect(() => () => {
    clearCurrentNote();
  }, [clearCurrentNote]);

  useEffect(() => {
    if (!currentNote || !isEditing) {
      if (!isEditing) {
        setTitle('Untitled Study Note');
        setTags('');
        setComponents([]);
      }
      return;
    }

    setTitle(currentNote.title);
    setTags(currentNote.tags.join(', '));
    setComponents(
      currentNote.components
        .sort((a, b) => a.sequence - b.sequence)
        .map((component) => ({
          componentId: component.componentId,
          componentType: component.componentType,
          content: component.content,
          metadata: component.metadata || {},
        }))
    );
  }, [currentNote, isEditing]);

  const parsedTags = useMemo(
    () =>
      tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    [tags]
  );

  const handleAddComponent = (type: NoteComponentType = 'HEADER') => {
    setComponents((prev) => [
      ...prev,
      {
        componentId: generateId(),
        componentType: type,
        content: '',
        metadata: {},
      },
    ]);
  };

  const handleComponentChange = (
    index: number,
    changes: Partial<EditableComponent>
  ) => {
    setComponents((prev) =>
      prev.map((component, idx) =>
        idx === index
          ? {
              ...component,
              ...changes,
            }
          : component
      )
    );
  };

  const handleRemoveComponent = (index: number) => {
    setComponents((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleStartQuiz = () => {
    if (!currentNote) {
      showError('Save the note before starting a quiz.');
      return;
    }
    resetSession();
    navigate(`/quiz/${currentNote.noteId}`);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      showError('Title is required.');
      return;
    }
    if (components.length === 0) {
      showError('Add at least one component before saving.');
      return;
    }
    if (components.some((component) => !component.content.trim())) {
      showError('All components must have content.');
      return;
    }

    setSaving(true);

    const payloadComponents = components.map((component, index) => ({
      componentId: component.componentId,
      componentType: component.componentType,
      content: component.content,
      sequence: index,
      metadata: component.metadata || {},
    }));

    try {
      if (isEditing && noteId) {
        await updateNote(noteId, {
          title,
          components: payloadComponents,
          tags: parsedTags,
        });
      } else {
        const created = await createNote({
          title,
          components: payloadComponents,
          tags: parsedTags,
        });
        if (created) {
          navigate(`/notes/${created.noteId}/edit`, { replace: true });
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const headerText = isEditing ? 'Edit Note' : 'Create Note';
  const subheader = isEditing
    ? 'Update components and launch targeted quizzes.'
    : 'Structure your knowledge to unlock adaptive quizzes.';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <button
            type="button"
            className="btn-outline mb-3"
            onClick={() => navigate('/study')}
          >
            <ArrowLeft className="h-4 w-4 mr-2 inline" /> Back to Study
          </button>
          <h1 className="text-3xl font-bold text-gray-900">{headerText}</h1>
          <p className="text-gray-600">{subheader}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isEditing && currentNote && (
            <button type="button" className="btn-secondary" onClick={handleStartQuiz}>
              <Sparkles className="h-4 w-4 mr-2 inline" /> Start Quiz
            </button>
          )}
          <button
            type="button"
            className="btn-primary flex items-center"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" /> Save
              </>
            )}
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="card flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary-600" />
          <span className="text-gray-600">Loading note...</span>
        </div>
      )}

      <div className="card space-y-6">
        <div>
          <label htmlFor="note-title" className="block text-sm font-medium text-gray-700 mb-1">
            Title
          </label>
          <input
            id="note-title"
            className="input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Enter a descriptive note title"
          />
        </div>

        <div>
          <label htmlFor="note-tags" className="block text-sm font-medium text-gray-700 mb-1">
            Tags (comma separated)
          </label>
          <input
            id="note-tags"
            className="input"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="e.g. linear algebra, eigenvalues"
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Components</h2>
            <button type="button" className="btn-outline" onClick={() => handleAddComponent('HEADER')}>
              <PlusCircle className="h-4 w-4 mr-2 inline" /> Add Component
            </button>
          </div>

          {components.length === 0 && (
            <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-500">
              <ScrollText className="h-8 w-8 mx-auto mb-3 text-gray-400" />
              Start by adding a component—headers, definitions, examples, and more.
            </div>
          )}

          <div className="space-y-4">
            {components.map((component, index) => (
              <div key={component.componentId} className="border border-gray-200 rounded-lg p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-500">#{index + 1}</span>
                    <select
                      className="input w-full sm:w-56"
                      value={component.componentType}
                      onChange={(event) =>
                        handleComponentChange(index, {
                          componentType: event.target.value as NoteComponentType,
                        })
                      }
                    >
                      {COMPONENT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    className="text-red-600 hover:text-red-700 flex items-center gap-1"
                    onClick={() => handleRemoveComponent(index)}
                  >
                    <Trash2 className="h-4 w-4" /> Remove
                  </button>
                </div>

                <p className="text-xs text-gray-500">
                  {COMPONENT_OPTIONS.find((option) => option.value === component.componentType)?.helper}
                </p>

                <textarea
                  className="input min-h-[140px]"
                  value={component.content}
                  onChange={(event) => handleComponentChange(index, { content: event.target.value })}
                  placeholder="Enter the content for this component"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
