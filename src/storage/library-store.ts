import type { Manga } from '../api/client';

const STORAGE_KEY = 'n-mgram.library';
const STORAGE_VERSION = 2;

export interface ReadingProgress {
  mangaId: number;
  title: string;
  cover: string;
  chapter: number;
  page: number;
  pageCount: number;
  latestChapter: number;
  updatedAt: string;
}

export type ReadingProgressUpdate = Omit<ReadingProgress, 'updatedAt'>;

export interface StoredLibrary {
  version: 2;
  favorites: number[];
  history: Record<string, ReadingProgress>;
  lastUpdateCheckAt?: string;
}

interface LegacyReadingProgress {
  mangaId: number;
  chapter: number;
  page: number;
  updatedAt: string;
}

function emptyLibrary(): StoredLibrary {
  return { version: STORAGE_VERSION, favorites: [], history: {} };
}

export function loadLibrary(): StoredLibrary {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return emptyLibrary();

  try {
    const value: unknown = JSON.parse(raw);
    if (isStoredLibrary(value)) return value;

    const migrated = migrateLegacyLibrary(value);
    if (migrated) {
      saveLibrary(migrated);
      return migrated;
    }
  } catch {
    // Invalid JSON is reset below in the same way as an incompatible schema.
  }

  localStorage.removeItem(STORAGE_KEY);
  return emptyLibrary();
}

function isStoredLibrary(value: unknown): value is StoredLibrary {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.version === STORAGE_VERSION &&
    isFavoriteList(candidate.favorites) &&
    isProgressRecord(candidate.history) &&
    (candidate.lastUpdateCheckAt === undefined || typeof candidate.lastUpdateCheckAt === 'string')
  );
}

function migrateLegacyLibrary(value: unknown): StoredLibrary | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Record<string, unknown>;
  if (
    candidate.version !== 1 ||
    !isFavoriteList(candidate.favorites) ||
    !candidate.progress ||
    typeof candidate.progress !== 'object'
  ) {
    return undefined;
  }

  const history: Record<string, ReadingProgress> = {};
  for (const [key, entry] of Object.entries(candidate.progress as Record<string, unknown>)) {
    if (!isLegacyProgress(entry)) return undefined;
    history[key] = {
      ...entry,
      title: '',
      cover: '',
      pageCount: 0,
      latestChapter: entry.chapter,
    };
  }

  return { version: STORAGE_VERSION, favorites: candidate.favorites, history };
}

function isFavoriteList(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((id) => Number.isInteger(id) && id > 0);
}

function isProgressRecord(value: unknown): value is Record<string, ReadingProgress> {
  return (
    !!value &&
    typeof value === 'object' &&
    Object.values(value as Record<string, unknown>).every(isReadingProgress)
  );
}

function isReadingProgress(value: unknown): value is ReadingProgress {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    Number.isInteger(candidate.mangaId) &&
    Number(candidate.mangaId) > 0 &&
    typeof candidate.title === 'string' &&
    typeof candidate.cover === 'string' &&
    isNonNegativeNumber(candidate.chapter) &&
    Number.isInteger(candidate.page) &&
    Number(candidate.page) >= 0 &&
    Number.isInteger(candidate.pageCount) &&
    Number(candidate.pageCount) >= 0 &&
    isNonNegativeNumber(candidate.latestChapter) &&
    typeof candidate.updatedAt === 'string'
  );
}

function isLegacyProgress(value: unknown): value is LegacyReadingProgress {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    Number.isInteger(candidate.mangaId) &&
    Number(candidate.mangaId) > 0 &&
    isNonNegativeNumber(candidate.chapter) &&
    Number.isInteger(candidate.page) &&
    Number(candidate.page) >= 0 &&
    typeof candidate.updatedAt === 'string'
  );
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function saveLibrary(value: StoredLibrary): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

function sortedHistory(library: StoredLibrary): ReadingProgress[] {
  return Object.values(library.history).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function toggleFavorite(mangaId: number): number[] {
  const library = loadLibrary();
  library.favorites = library.favorites.includes(mangaId)
    ? library.favorites.filter((id) => id !== mangaId)
    : [...library.favorites, mangaId];
  saveLibrary(library);
  return library.favorites;
}

export function saveProgress(progress: ReadingProgressUpdate): ReadingProgress[] {
  const library = loadLibrary();
  const current = library.history[String(progress.mangaId)];
  library.history[String(progress.mangaId)] = {
    ...progress,
    latestChapter: Math.max(progress.chapter, progress.latestChapter, current?.latestChapter ?? 0),
    updatedAt: new Date().toISOString(),
  };
  saveLibrary(library);
  return sortedHistory(library);
}

export function getProgress(mangaId: number): ReadingProgress | undefined {
  return loadLibrary().history[String(mangaId)];
}

export function getHistory(): ReadingProgress[] {
  return sortedHistory(loadLibrary());
}

export function removeHistory(mangaId: number): ReadingProgress[] {
  const library = loadLibrary();
  delete library.history[String(mangaId)];
  saveLibrary(library);
  return sortedHistory(library);
}

export function clearHistory(): ReadingProgress[] {
  const library = loadLibrary();
  library.history = {};
  saveLibrary(library);
  return [];
}

export function updateHistoryCatalog(
  mangaList: readonly Manga[],
  markCheckComplete = false,
): StoredLibrary {
  const library = loadLibrary();
  for (const manga of mangaList) {
    const entry = library.history[String(manga.id)];
    if (!entry) continue;
    const latestChapter = parseChapterNumber(manga.lastChapter);
    library.history[String(manga.id)] = {
      ...entry,
      title: manga.name,
      cover: manga.cover,
      latestChapter: Math.max(entry.latestChapter, latestChapter ?? entry.chapter),
    };
  }
  if (markCheckComplete) library.lastUpdateCheckAt = new Date().toISOString();
  saveLibrary(library);
  return library;
}

export function getProgressPercentage(progress: ReadingProgress): number {
  if (progress.pageCount <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round(((progress.page + 1) / progress.pageCount) * 100)));
}

export function hasNewChapter(progress: ReadingProgress): boolean {
  return progress.latestChapter > progress.chapter;
}

export function hasCompleteHistoryMetadata(progress: ReadingProgress): boolean {
  return progress.title.trim().length > 0 && progress.cover.trim().length > 0;
}

function parseChapterNumber(value: string): number | undefined {
  const chapter = Number(value);
  return Number.isFinite(chapter) && chapter >= 0 ? chapter : undefined;
}
