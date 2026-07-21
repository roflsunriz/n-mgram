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
  getChapters: vi.fn(async () => [
    {
      mid: 7,
      name: '復元された作品',
      chapter: 3,
      content: [
        'https://ihlv1.xyz/3-1.webp',
        'https://ihlv1.xyz/3-2.webp',
        'https://ihlv1.xyz/3-3.webp',
        'https://ihlv1.xyz/3-4.webp',
        'https://ihlv1.xyz/3-5.webp',
        'https://ihlv1.xyz/3-6.webp',
      ],
      time: '',
      views: 0,
    },
  ]),
  resolvePageImage: vi.fn(async (url: string) => ({ blocked: false, source: url })),
  searchManga: vi.fn(async () => []),
}));

class IntersectionObserverStub {
  observe() {}
  disconnect() {}
}

Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
  value: vi.fn(),
  configurable: true,
});
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  value: vi.fn(),
  configurable: true,
});

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
    vi.stubGlobal('IntersectionObserver', IntersectionObserverStub);
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
    const updatesStack = document.querySelector('.updates-stack');
    expect(updatesStack?.children[0]).toBe(screen.getByTestId('chapter-updates-panel'));
    expect(updatesStack?.children[1]).toBe(screen.getByTestId('app-updater-panel'));
  });

  it('returns every non-discover library tab to Discover on browser back', () => {
    render(<App />);
    const discoverState = { nMgramScreen: 'library', nMgramLibraryPage: 'discover' };

    for (const page of ['search', 'history', 'updates'] as const) {
      fireEvent.click(screen.getByTestId(`library-tab-${page}`));
      expect(window.history.state.nMgramLibraryPage).toBe(page);
      window.history.replaceState(discoverState, '');
      fireEvent.popState(window, { state: discoverState });
      expect(screen.getByRole('heading', { name: '見つける' })).toBeTruthy();
    }
  });

  it('opens a history entry directly at the saved chapter and lets browser back return to history', async () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('library-tab-history'));
    await waitFor(() => expect(screen.getByTestId('history-open-7')).toBeTruthy());

    fireEvent.click(screen.getByTestId('history-open-7'));
    await waitFor(() => expect(screen.getByTestId('reader')).toBeTruthy());
    expect(screen.getByText('5 / 6')).toBeTruthy();
    expect((screen.getByRole('combobox', { name: '章' }) as HTMLSelectElement).value).toBe('0');
    await waitFor(() =>
      expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'start' }),
    );

    fireEvent.popState(window, {
      state: { nMgramScreen: 'library', nMgramLibraryPage: 'history' },
    });
    expect(screen.getByRole('heading', { name: '読んだ作品' })).toBeTruthy();
  });

  it('shows saved favorites below reading history', async () => {
    localStorage.setItem(
      'n-mgram.library',
      JSON.stringify({
        version: 3,
        favorites: [{ mangaId: 7, title: '復元された作品' }],
        history: {},
      }),
    );
    render(<App />);
    fireEvent.click(screen.getByTestId('library-tab-history'));

    expect(screen.getByRole('heading', { name: 'お気に入り' })).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('manga-7')).toBeTruthy());
  });
});
