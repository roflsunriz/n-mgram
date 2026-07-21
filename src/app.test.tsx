// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Manga } from './api/client';
import { App } from './app';

const restoredManga: Manga = {
  id: 7,
  name: '復元された作品',
  slug: '',
  authors: '作者',
  transGroup: '',
  artists: '',
  released: 2026,
  otherName: '',
  genres: '',
  description: '',
  mStatus: 2,
  lastUpdate: '',
  post: '',
  cover: 'https://ihlv1.xyz/restored.webp',
  lastChapter: '5',
  views: 0,
  submitter: 0,
  groupUploader: 0,
  hidden: 0,
  magazines: '',
};

vi.mock('./api/client', () => ({
  getCollection: vi.fn(async () => []),
  getManga: vi.fn(async () => restoredManga),
  getChapters: vi.fn(async () => []),
  searchManga: vi.fn(async () => []),
}));

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

describe('App library pages', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorage());
    Object.defineProperty(window.navigator, 'language', { value: 'ja-JP', configurable: true });
    localStorage.clear();
    localStorage.setItem(
      'n-mgram.library',
      JSON.stringify({
        version: 1,
        favorites: [],
        progress: {
          7: { mangaId: 7, chapter: 3, page: 4, updatedAt: '2026-07-21T12:00:00.000Z' },
        },
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('separates the four pages and restores real history metadata before showing an entry', async () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: '見つける' })).toBeTruthy();
    expect(screen.queryByText('復元された作品')).toBeNull();

    fireEvent.click(screen.getByTestId('library-tab-history'));
    await waitFor(() => expect(screen.getByText('復元された作品')).toBeTruthy());
    expect(screen.queryByText('作品 #7')).toBeNull();
    expect(screen.getByText('第3話 · 0% 読了')).toBeTruthy();

    fireEvent.click(screen.getByTestId('library-tab-search'));
    expect(screen.getByRole('heading', { name: '作品を検索' })).toBeTruthy();
    expect(screen.queryByText('復元された作品')).toBeNull();

    fireEvent.click(screen.getByTestId('library-tab-updates'));
    expect(screen.getByRole('heading', { name: '新しい章' })).toBeTruthy();
  });
});
