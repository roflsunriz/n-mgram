const STORAGE_KEY = 'n-mgram.reader-settings';
const STORAGE_VERSION = 1;

export type ReaderMode = 'continuous' | 'paged';
export type ReaderFitMode = 'width' | 'height' | 'original';

export interface ReaderSettings {
  version: 1;
  mode: ReaderMode;
  fit: ReaderFitMode;
}

function defaultSettings(): ReaderSettings {
  return { version: STORAGE_VERSION, mode: 'continuous', fit: 'width' };
}

export function loadReaderSettings(): ReaderSettings {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultSettings();

  try {
    const value: unknown = JSON.parse(raw);
    if (isReaderSettings(value)) return value;
  } catch {
    // Invalid JSON is reset below in the same way as an incompatible schema.
  }

  localStorage.removeItem(STORAGE_KEY);
  return defaultSettings();
}

export function saveReaderSettings(settings: ReaderSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function isReaderSettings(value: unknown): value is ReaderSettings {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.version === STORAGE_VERSION &&
    (candidate.mode === 'continuous' || candidate.mode === 'paged') &&
    (candidate.fit === 'width' || candidate.fit === 'height' || candidate.fit === 'original')
  );
}
