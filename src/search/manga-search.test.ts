import { describe, expect, it } from 'vitest';
import type { Manga } from '../api/client';
import {
  createDefaultMangaFilters,
  createMangaSearchRequest,
  filterAndSortManga,
  getDirectMangaId,
} from './manga-search';

const base: Manga = {
  id: 1,
  name: 'Alpha Story',
  slug: 'alpha-story',
  authors: 'Author A',
  transGroup: 'Group A',
  artists: 'Artist A',
  released: 2020,
  otherName: 'アルファ物語',
  genres: 'action,fantasy',
  description: 'A long journey.',
  mStatus: 2,
  views: 120,
  lastUpdate: '2026-07-20T10:00:00Z',
  post: '2020-01-02T00:00:00Z',
  cover: 'https://s4.ihlv1.xyz/alpha.webp',
  lastChapter: '12.5',
  submitter: 1,
  groupUploader: 2,
  hidden: 0,
  magazines: 'Magazine A',
};

const beta: Manga = {
  ...base,
  id: 2,
  name: 'Beta Romance',
  slug: 'beta-romance',
  authors: 'Author B',
  transGroup: 'Group B',
  artists: 'Artist B',
  released: 2024,
  otherName: 'ベータ恋愛',
  genres: 'drama,romance',
  description: 'A school romance.',
  mStatus: 1,
  views: 900,
  lastUpdate: '2026-07-21T10:00:00Z',
  post: '2024-02-03T00:00:00Z',
  cover: 'https://ihlv1.xyz/beta.webp',
  lastChapter: '30',
  submitter: 3,
  groupUploader: 4,
  hidden: 1,
  magazines: 'Magazine B',
};

describe('manga metadata search', () => {
  it('matches a global keyword against every available metadata field', () => {
    for (const keyword of ['アルファ', 'Group A', 'fantasy', 'journey', 's4.ihlv1.xyz', '12.5']) {
      const filters = { ...createDefaultMangaFilters(keyword), hidden: 'any' as const };
      expect(filterAndSortManga([base, beta], filters).map((manga) => manga.id)).toEqual([1]);
    }
  });

  it('combines text, status, numeric, date, technical, and visibility filters', () => {
    const filters = {
      ...createDefaultMangaFilters(),
      artist: 'Artist B',
      genres: 'drama, romance',
      status: 'completed' as const,
      viewsFrom: '800',
      chapterFrom: '20',
      postedFrom: '2024-01-01',
      updatedTo: '2026-07-21',
      submitter: '3',
      groupUploader: '4',
      hidden: 'hidden' as const,
    };
    expect(filterAndSortManga([base, beta], filters)).toEqual([beta]);
  });

  it('sorts numeric and text metadata in either direction', () => {
    const byViews = {
      ...createDefaultMangaFilters(),
      hidden: 'any' as const,
      sortBy: 'views' as const,
    };
    expect(filterAndSortManga([beta, base], byViews).map((manga) => manga.id)).toEqual([1, 2]);
    expect(
      filterAndSortManga([base, beta], { ...byViews, direction: 'desc' }).map((manga) => manga.id),
    ).toEqual([2, 1]);
  });

  it('maps supported fields to the server-side advanced search payload', () => {
    const request = createMangaSearchRequest(
      {
        ...createDefaultMangaFilters('magic'),
        title: 'Story',
        author: 'Author',
        genres: 'action, fantasy',
        magazine: 'Comic',
        status: 'ongoing',
      },
      2,
      100,
    );
    expect(request).toEqual({
      query: 'magic',
      name: 'Story',
      authors: 'Author',
      genres: ['action', 'fantasy'],
      magazines: 'Comic',
      status: 'Ongoing',
      page: 2,
      size: 100,
    });
  });

  it('accepts only a positive integer as a direct title lookup ID', () => {
    expect(getDirectMangaId({ ...createDefaultMangaFilters(), mangaId: '8297' })).toBe(8297);
    expect(getDirectMangaId({ ...createDefaultMangaFilters(), mangaId: '0' })).toBeUndefined();
    expect(getDirectMangaId({ ...createDefaultMangaFilters(), mangaId: '12.5' })).toBeUndefined();
  });
});
