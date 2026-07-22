import type { Manga, MangaSearchRequest } from '../api/client';

export type ChapterLengthTier = 'any' | 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type HiddenFilter = 'visible' | 'hidden' | 'any';
export type SortDirection = 'asc' | 'desc';
export type MangaSortKey =
  | 'id'
  | 'name'
  | 'otherName'
  | 'slug'
  | 'authors'
  | 'artists'
  | 'genres'
  | 'magazines'
  | 'transGroup'
  | 'description'
  | 'released'
  | 'mStatus'
  | 'views'
  | 'lastUpdate'
  | 'post'
  | 'lastChapter'
  | 'submitter'
  | 'groupUploader'
  | 'hidden'
  | 'cover';

export interface MangaFilters {
  keyword: string;
  title: string;
  otherName: string;
  slug: string;
  author: string;
  artist: string;
  genres: string;
  magazine: string;
  translationGroup: string;
  description: string;
  cover: string;
  mangaId: string;
  viewsFrom: string;
  viewsTo: string;
  chapterFrom: string;
  chapterTo: string;
  chapterLength: ChapterLengthTier;
  postedFrom: string;
  postedTo: string;
  updatedFrom: string;
  updatedTo: string;
  submitter: string;
  groupUploader: string;
  hidden: HiddenFilter;
  sortBy: MangaSortKey;
  direction: SortDirection;
}

export function createDefaultMangaFilters(keyword = ''): MangaFilters {
  return {
    keyword,
    title: '',
    otherName: '',
    slug: '',
    author: '',
    artist: '',
    genres: '',
    magazine: '',
    translationGroup: '',
    description: '',
    cover: '',
    mangaId: '',
    viewsFrom: '',
    viewsTo: '',
    chapterFrom: '',
    chapterTo: '',
    chapterLength: 'any',
    postedFrom: '',
    postedTo: '',
    updatedFrom: '',
    updatedTo: '',
    submitter: '',
    groupUploader: '',
    hidden: 'visible',
    sortBy: 'lastUpdate',
    direction: 'desc',
  };
}

export function hasSearchCriteria(filters: MangaFilters): boolean {
  const defaults = createDefaultMangaFilters();
  return (Object.keys(defaults) as Array<keyof MangaFilters>).some(
    (key) => key !== 'sortBy' && key !== 'direction' && filters[key] !== defaults[key],
  );
}

export function countActiveFilters(filters: MangaFilters): number {
  const defaults = createDefaultMangaFilters();
  return (Object.keys(defaults) as Array<keyof MangaFilters>).filter(
    (key) => filters[key] !== defaults[key],
  ).length;
}

export function getDirectMangaId(filters: MangaFilters): number | undefined {
  if (!filters.mangaId.trim()) return undefined;
  const mangaId = Number(filters.mangaId);
  return Number.isInteger(mangaId) && mangaId > 0 ? mangaId : undefined;
}

export function createMangaSearchRequest(
  filters: MangaFilters,
  page: number,
  size: number,
): MangaSearchRequest {
  return {
    query: filters.keyword.trim(),
    name: filters.title.trim(),
    authors: filters.author.trim(),
    genres: splitList(filters.genres),
    magazines: filters.magazine.trim(),
    status: 'Any',
    page,
    size,
  };
}

export function filterAndSortManga(items: readonly Manga[], filters: MangaFilters): Manga[] {
  const filtered = items.filter((manga) => matchesManga(manga, filters));

  return [...filtered].sort((left, right) => {
    const comparison = compareMetadata(left, right, filters.sortBy);
    return filters.direction === 'asc' ? comparison : -comparison;
  });
}

function matchesManga(manga: Manga, filters: MangaFilters): boolean {
  const keywordValues = [
    manga.id,
    manga.name,
    manga.slug,
    manga.authors,
    manga.transGroup,
    manga.artists,
    manga.released,
    manga.otherName,
    manga.genres,
    manga.description,
    manga.mStatus,
    manga.views,
    manga.lastUpdate,
    manga.post,
    manga.cover,
    manga.lastChapter,
    manga.submitter,
    manga.groupUploader,
    manga.hidden,
    manga.magazines,
  ];
  if (!includesText(keywordValues.join(' '), filters.keyword)) return false;
  if (!includesText(manga.name, filters.title)) return false;
  if (!includesText(manga.otherName, filters.otherName)) return false;
  if (!includesText(manga.slug, filters.slug)) return false;
  if (!includesText(manga.authors, filters.author)) return false;
  if (!includesText(manga.artists, filters.artist)) return false;
  if (!includesText(manga.magazines, filters.magazine)) return false;
  if (!includesText(manga.transGroup, filters.translationGroup)) return false;
  if (!includesText(manga.description, filters.description)) return false;
  if (!includesText(manga.cover, filters.cover)) return false;

  const requestedGenres = splitList(filters.genres).map(normalizeText);
  const mangaGenres = splitList(manga.genres).map(normalizeText);
  if (!requestedGenres.every((genre) => mangaGenres.includes(genre))) return false;

  if (!matchesExactNumber(manga.id, filters.mangaId)) return false;
  if (!matchesNumberRange(manga.views, filters.viewsFrom, filters.viewsTo)) return false;
  if (!matchesNumberRange(Number(manga.lastChapter), filters.chapterFrom, filters.chapterTo))
    return false;
  if (!matchesChapterLengthTier(Number(manga.lastChapter), filters.chapterLength)) return false;
  if (!matchesDateRange(manga.post, filters.postedFrom, filters.postedTo)) return false;
  if (!matchesDateRange(manga.lastUpdate, filters.updatedFrom, filters.updatedTo)) return false;
  if (!matchesExactNumber(manga.submitter, filters.submitter)) return false;
  if (!matchesExactNumber(manga.groupUploader, filters.groupUploader)) return false;
  if (filters.hidden === 'visible' && manga.hidden !== 0) return false;
  if (filters.hidden === 'hidden' && manga.hidden === 0) return false;
  return true;
}

function compareMetadata(left: Manga, right: Manga, key: MangaSortKey): number {
  if (key === 'lastChapter') return compareNumbers(Number(left[key]), Number(right[key]));
  if (key === 'lastUpdate' || key === 'post')
    return compareNumbers(Date.parse(left[key]) || 0, Date.parse(right[key]) || 0);
  if (
    key === 'id' ||
    key === 'released' ||
    key === 'mStatus' ||
    key === 'views' ||
    key === 'submitter' ||
    key === 'groupUploader' ||
    key === 'hidden'
  ) {
    return compareNumbers(left[key], right[key]);
  }
  return String(left[key]).localeCompare(String(right[key]), 'ja', {
    sensitivity: 'base',
    numeric: true,
  });
}

function normalizeText(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase();
}

function includesText(value: string, query: string): boolean {
  const normalizedQuery = normalizeText(query);
  return !normalizedQuery || normalizeText(value).includes(normalizedQuery);
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function optionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function matchesExactNumber(value: number, filter: string): boolean {
  const expected = optionalNumber(filter);
  return expected === undefined || value === expected;
}

function matchesNumberRange(value: number, from: string, to: string): boolean {
  const minimum = optionalNumber(from);
  const maximum = optionalNumber(to);
  return (minimum === undefined || value >= minimum) && (maximum === undefined || value <= maximum);
}

function matchesChapterLengthTier(value: number, tier: ChapterLengthTier): boolean {
  if (tier === 'any') return true;
  if (!Number.isFinite(value) || value <= 0) return false;
  if (tier === 'common') return value <= 10;
  if (tier === 'uncommon') return value <= 25 && value > 10;
  if (tier === 'rare') return value <= 50 && value > 25;
  if (tier === 'epic') return value <= 100 && value > 50;
  return value > 100;
}

function matchesDateRange(value: string, from: string, to: string): boolean {
  if (!from && !to) return true;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return false;
  const minimum = from ? Date.parse(`${from}T00:00:00.000Z`) : undefined;
  const maximum = to ? Date.parse(`${to}T23:59:59.999Z`) : undefined;
  return (
    (minimum === undefined || timestamp >= minimum) &&
    (maximum === undefined || timestamp <= maximum)
  );
}

function compareNumbers(left: number, right: number): number {
  const safeLeft = Number.isFinite(left) ? left : 0;
  const safeRight = Number.isFinite(right) ? right : 0;
  return safeLeft - safeRight;
}
