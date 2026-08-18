import type { Chapter, Manga } from '../api/client';
import {
  compareChapterNumbers,
  findChapterNumberIndex,
  isChapterNumber,
  maxChapterNumber,
  type ChapterNumber,
} from '../api/chapter-number';

const STORAGE_KEY = 'n-mgram.library';
const STORAGE_VERSION = 4;

export interface FavoriteEntry {
  mangaId: number;
  title: string;
}

export interface ReadingProgress {
  mangaId: number;
  title: string;
  cover: string;
  chapter: ChapterNumber;
  page: number;
  pageCount: number;
  chapterIndex: number;
  chapterCount: number;
  latestChapter: ChapterNumber;
  updatedAt: string;
}

export type ReadingProgressUpdate = Omit<ReadingProgress, 'updatedAt'>;

export interface StoredLibrary {
  version: 4;
  favorites: FavoriteEntry[];
  history: Record<string, ReadingProgress>;
  lastUpdateCheckAt?: string;
}

interface LegacyReadingProgress {
  mangaId: number;
  chapter: ChapterNumber;
  page: number;
  updatedAt: string;
}

type Version3ReadingProgress = Omit<ReadingProgress, 'chapterIndex' | 'chapterCount'>;

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
    isFavoriteEntries(candidate.favorites) &&
    isProgressRecord(candidate.history) &&
    (candidate.lastUpdateCheckAt === undefined || typeof candidate.lastUpdateCheckAt === 'string')
  );
}

function migrateLegacyLibrary(value: unknown): StoredLibrary | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Record<string, unknown>;
  if (candidate.version === 3) {
    if (
      !isFavoriteEntries(candidate.favorites) ||
      !isVersion3ProgressRecord(candidate.history) ||
      (candidate.lastUpdateCheckAt !== undefined && typeof candidate.lastUpdateCheckAt !== 'string')
    ) {
      return undefined;
    }
    return {
      version: STORAGE_VERSION,
      favorites: candidate.favorites,
      history: migrateVersion3Progress(candidate.history),
      ...(candidate.lastUpdateCheckAt ? { lastUpdateCheckAt: candidate.lastUpdateCheckAt } : {}),
    };
  }

  if (candidate.version === 2) {
    if (
      !isLegacyFavoriteList(candidate.favorites) ||
      !isVersion3ProgressRecord(candidate.history) ||
      (candidate.lastUpdateCheckAt !== undefined && typeof candidate.lastUpdateCheckAt !== 'string')
    ) {
      return undefined;
    }
    const history = migrateVersion3Progress(candidate.history);
    return {
      version: STORAGE_VERSION,
      favorites: candidate.favorites.map((mangaId) => ({
        mangaId,
        title: history[String(mangaId)]?.title ?? '',
      })),
      history,
      ...(candidate.lastUpdateCheckAt ? { lastUpdateCheckAt: candidate.lastUpdateCheckAt } : {}),
    };
  }

  if (
    candidate.version !== 1 ||
    !isLegacyFavoriteList(candidate.favorites) ||
    !candidate.progress ||
    typeof candidate.progress !== 'object'
  )
    return undefined;

  const history: Record<string, ReadingProgress> = {};
  for (const [key, entry] of Object.entries(candidate.progress as Record<string, unknown>)) {
    if (!isLegacyProgress(entry)) return undefined;
    history[key] = {
      ...entry,
      title: '',
      cover: '',
      pageCount: 0,
      chapterIndex: 0,
      chapterCount: 0,
      latestChapter: entry.chapter,
    };
  }

  return {
    version: STORAGE_VERSION,
    favorites: candidate.favorites.map((mangaId) => ({ mangaId, title: '' })),
    history,
  };
}

function isLegacyFavoriteList(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((id) => Number.isInteger(id) && id > 0);
}

function isFavoriteEntries(value: unknown): value is FavoriteEntry[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        !!entry &&
        typeof entry === 'object' &&
        Number.isInteger(Reflect.get(entry, 'mangaId')) &&
        Number(Reflect.get(entry, 'mangaId')) > 0 &&
        typeof Reflect.get(entry, 'title') === 'string',
    )
  );
}

function isProgressRecord(value: unknown): value is Record<string, ReadingProgress> {
  return (
    !!value &&
    typeof value === 'object' &&
    Object.values(value as Record<string, unknown>).every(isReadingProgress)
  );
}

function isVersion3ProgressRecord(
  value: unknown,
): value is Record<string, Version3ReadingProgress> {
  return (
    !!value &&
    typeof value === 'object' &&
    Object.values(value as Record<string, unknown>).every(isVersion3ReadingProgress)
  );
}

function migrateVersion3Progress(
  history: Record<string, Version3ReadingProgress>,
): Record<string, ReadingProgress> {
  return Object.fromEntries(
    Object.entries(history).map(([key, entry]) => [
      key,
      { ...entry, chapterIndex: 0, chapterCount: 0 },
    ]),
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
    isChapterNumber(candidate.chapter) &&
    Number.isInteger(candidate.page) &&
    Number(candidate.page) >= 0 &&
    Number.isInteger(candidate.pageCount) &&
    Number(candidate.pageCount) >= 0 &&
    Number.isInteger(candidate.chapterIndex) &&
    Number(candidate.chapterIndex) >= 0 &&
    Number.isInteger(candidate.chapterCount) &&
    Number(candidate.chapterCount) >= 0 &&
    isChapterNumber(candidate.latestChapter) &&
    typeof candidate.updatedAt === 'string'
  );
}

function isVersion3ReadingProgress(value: unknown): value is Version3ReadingProgress {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    Number.isInteger(candidate.mangaId) &&
    Number(candidate.mangaId) > 0 &&
    typeof candidate.title === 'string' &&
    typeof candidate.cover === 'string' &&
    isChapterNumber(candidate.chapter) &&
    Number.isInteger(candidate.page) &&
    Number(candidate.page) >= 0 &&
    Number.isInteger(candidate.pageCount) &&
    Number(candidate.pageCount) >= 0 &&
    isChapterNumber(candidate.latestChapter) &&
    typeof candidate.updatedAt === 'string'
  );
}

function isLegacyProgress(value: unknown): value is LegacyReadingProgress {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    Number.isInteger(candidate.mangaId) &&
    Number(candidate.mangaId) > 0 &&
    isChapterNumber(candidate.chapter) &&
    Number.isInteger(candidate.page) &&
    Number(candidate.page) >= 0 &&
    typeof candidate.updatedAt === 'string'
  );
}

function saveLibrary(value: StoredLibrary): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

function sortedHistory(library: StoredLibrary): ReadingProgress[] {
  return Object.values(library.history).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function toggleFavorite(manga: Pick<Manga, 'id' | 'name'>): FavoriteEntry[] {
  const library = loadLibrary();
  library.favorites = library.favorites.some((entry) => entry.mangaId === manga.id)
    ? library.favorites.filter((entry) => entry.mangaId !== manga.id)
    : [...library.favorites, { mangaId: manga.id, title: manga.name }];
  saveLibrary(library);
  return library.favorites;
}

export function saveProgress(progress: ReadingProgressUpdate): ReadingProgress[] {
  const library = loadLibrary();
  const current = library.history[String(progress.mangaId)];
  library.history[String(progress.mangaId)] = {
    ...progress,
    latestChapter: maxChapterNumber(
      progress.chapter,
      progress.latestChapter,
      current?.latestChapter ?? 0,
    ),
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
    library.favorites = library.favorites.map((favorite) =>
      favorite.mangaId === manga.id ? { ...favorite, title: manga.name } : favorite,
    );
    const entry = library.history[String(manga.id)];
    if (!entry) continue;
    const latestChapter = parseChapterNumber(manga.lastChapter);
    const nextLatestChapter =
      latestChapter === undefined
        ? entry.latestChapter
        : maxChapterNumber(entry.latestChapter, latestChapter);
    const chapterCatalogChanged = compareChapterNumbers(nextLatestChapter, entry.latestChapter) > 0;
    library.history[String(manga.id)] = {
      ...entry,
      title: manga.name,
      cover: manga.cover,
      latestChapter: nextLatestChapter,
      chapterCount: chapterCatalogChanged ? 0 : entry.chapterCount,
    };
  }
  if (markCheckComplete) library.lastUpdateCheckAt = new Date().toISOString();
  saveLibrary(library);
  return library;
}

export interface HistoryChapterCatalog {
  mangaId: number;
  chapters: readonly Pick<Chapter, 'chapter'>[];
}

export function updateHistoryChapterCatalogs(
  catalogs: readonly HistoryChapterCatalog[],
): ReadingProgress[] {
  const library = loadLibrary();
  let changed = false;
  for (const catalog of catalogs) {
    const entry = library.history[String(catalog.mangaId)];
    if (!entry || catalog.chapters.length === 0) continue;
    const chapterIndex = findChapterNumberIndex(catalog.chapters, entry.chapter);
    if (chapterIndex < 0) continue;
    library.history[String(catalog.mangaId)] = {
      ...entry,
      chapterIndex,
      chapterCount: catalog.chapters.length,
    };
    changed = true;
  }
  if (changed) saveLibrary(library);
  return sortedHistory(library);
}

export function getProgressPercentage(progress: ReadingProgress): number {
  if (!hasCompleteMangaProgress(progress)) return 0;
  const pageProgress =
    progress.pageCount <= 0
      ? 0
      : Math.min(1, Math.max(0, (progress.page + 1) / progress.pageCount));
  return Math.min(
    100,
    Math.max(0, Math.round(((progress.chapterIndex + pageProgress) / progress.chapterCount) * 100)),
  );
}

export function hasCompleteMangaProgress(progress: ReadingProgress): boolean {
  return progress.chapterCount > 0 && progress.chapterIndex < progress.chapterCount;
}

export function hasNewChapter(progress: ReadingProgress): boolean {
  return compareChapterNumbers(progress.latestChapter, progress.chapter) > 0;
}

export function hasCompleteHistoryMetadata(progress: ReadingProgress): boolean {
  return progress.title.trim().length > 0 && progress.cover.trim().length > 0;
}

function parseChapterNumber(value: string): ChapterNumber | undefined {
  return isChapterNumber(value) ? value : undefined;
}
