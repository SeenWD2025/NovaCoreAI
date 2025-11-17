const TELEMETRY_STORAGE_KEY = 'novaTelemetryLog';
const TELEMETRY_MAX_ENTRIES = 50;

interface TelemetryEntry {
  id: string;
  event: string;
  timestamp: string;
  payload?: Record<string, unknown>;
}

const safeGetStorage = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage;
  } catch (error) {
    console.debug('[telemetry] Local storage unavailable', error);
    return null;
  }
};

const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `telemetry-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const recordTelemetry = (event: string, payload?: Record<string, unknown>) => {
  const storage = safeGetStorage();
  const entry: TelemetryEntry = {
    id: generateId(),
    event,
    timestamp: new Date().toISOString(),
    payload,
  };

  try {
    const existingRaw = storage?.getItem(TELEMETRY_STORAGE_KEY);
    const existing: TelemetryEntry[] = existingRaw ? JSON.parse(existingRaw) : [];
    const updated = [entry, ...existing].slice(0, TELEMETRY_MAX_ENTRIES);
    storage?.setItem(TELEMETRY_STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.debug('[telemetry] Failed to persist entry', error, entry);
  }

  if (import.meta.env.DEV) {
    console.debug('[telemetry]', event, payload);
  }
};

export const recordQuizSubmissionTelemetry = (
  outcome: 'success' | 'error',
  payload: Record<string, unknown>
) => {
  recordTelemetry(`quiz_submission_${outcome}`, payload);
};
