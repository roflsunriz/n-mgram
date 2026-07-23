// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCollection, searchManga } from './api/client';
import type { Manga } from './api/client';
import { App } from './app';
import { prefetchChapterEdges } from './services/chapter-edge-prefetch';

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

function createMangaPage(startId: number, count = 24): Manga[] {
  return Array.from({ length: count }, (_, index) => ({
    ...restoredManga,
    id: startId + index,
    name: `作品 ${startId + index}`,
  }));
}

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

vi.mock('./services/chapter-edge-prefetch', () => ({ prefetchChapterEdges: vi.fn() }));

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
    Object.defineProperty(window.history, 'scrollRestoration', {
      value: 'auto',
      writable: true,
      configurable: true,
    });
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
    expect(screen.getByText('読書履歴とお気に入りをまとめて確認・管理できます。')).toBeTruthy();
    expect(screen.queryByText('作品 #7')).toBeNull();
    expect(screen.getByText('第3話 · 0% 読了')).toBeTruthy();

    fireEvent.click(screen.getByTestId('library-tab-search'));
    expect(screen.getByTestId('advanced-search')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: '作品を検索' })).toBeNull();
    expect(screen.queryByText('復元された作品')).toBeNull();

    fireEvent.click(screen.getByTestId('library-tab-updates'));
    expect(screen.getByRole('heading', { name: '更新センター' })).toBeTruthy();
    expect(
      screen.getByText('新着チャプターの確認とアプリのアップデートをまとめて管理できます。'),
    ).toBeTruthy();
    const updatesStack = document.querySelector('.updates-stack');
    expect(updatesStack?.children[0]).toBe(screen.getByTestId('chapter-updates-panel'));
    expect(updatesStack?.children[1]).toBe(screen.getByTestId('app-updater-panel'));
  });

  it('returns every non-discover library tab to Discover on browser back', () => {
    render(<App />);
    expect(window.history.scrollRestoration).toBe('manual');
    const discoverState = { nMgramScreen: 'library', nMgramLibraryPage: 'discover' };

    for (const page of ['search', 'history', 'updates'] as const) {
      fireEvent.click(screen.getByTestId(`library-tab-${page}`));
      expect(window.history.state.nMgramLibraryPage).toBe(page);
      window.history.replaceState(discoverState, '');
      fireEvent.popState(window, { state: discoverState });
      expect(screen.getByRole('heading', { name: '見つける' })).toBeTruthy();
    }
  });

  it('sorts loaded search results without sending another API request', async () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('library-tab-search'));

    fireEvent.change(screen.getByLabelText('作品名・作者名で検索'), {
      target: { value: 'magic' },
    });
    const searchInput = screen.getByLabelText('作品名・作者名で検索');
    fireEvent.submit(searchInput.closest('form')!);
    await waitFor(() => expect(searchManga).toHaveBeenCalledOnce());
    vi.mocked(searchManga).mockClear();

    fireEvent.change(screen.getByTestId('search-sort'), { target: { value: 'views:desc' } });

    expect(searchManga).not.toHaveBeenCalled();
    expect((screen.getByTestId('search-sort') as HTMLSelectElement).value).toBe('views:desc');
  });

  it('warms every Discover sort and switches cached tabs without another request or loader', async () => {
    const mangaBySort: Record<string, Manga> = {
      update: { ...restoredManga, id: 11, name: '更新順の作品' },
      new: { ...restoredManga, id: 12, name: '新着の作品' },
      top: { ...restoredManga, id: 13, name: '人気の作品' },
    };
    vi.mocked(getCollection).mockImplementation(async (_page, order) => [mangaBySort[order]!]);

    render(<App />);

    await waitFor(() => expect(getCollection).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(screen.getByTestId('manga-11')).toBeTruthy());
    expect(getCollection).toHaveBeenCalledWith(1, 'update', 24);
    expect(getCollection).toHaveBeenCalledWith(1, 'new', 24);
    expect(getCollection).toHaveBeenCalledWith(1, 'top', 24);

    fireEvent.click(screen.getByRole('button', { name: '新着' }));
    expect(screen.getByTestId('manga-12')).toBeTruthy();
    expect(document.querySelector('.loading-row')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '人気' }));
    expect(screen.getByTestId('manga-13')).toBeTruthy();
    expect(document.querySelector('.loading-row')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '更新順' }));
    expect(screen.getByTestId('manga-11')).toBeTruthy();
    expect(getCollection).toHaveBeenCalledTimes(3);
  });

  it('does not duplicate a background request when its Discover tab is selected early', async () => {
    let resolveNewest: ((items: Manga[]) => void) | undefined;
    vi.mocked(getCollection).mockImplementation((_page, order) =>
      order === 'new'
        ? new Promise<Manga[]>((resolve) => {
            resolveNewest = resolve;
          })
        : Promise.resolve([]),
    );

    render(<App />);
    await waitFor(() => expect(getCollection).toHaveBeenCalledTimes(3));
    fireEvent.click(screen.getByRole('button', { name: '新着' }));

    expect(vi.mocked(getCollection).mock.calls.filter((call) => call[1] === 'new')).toHaveLength(1);
    resolveNewest?.([]);
  });

  it('shows Load more only after the next Discover page is ready and reveals it without waiting', async () => {
    let resolveSecondPage: ((items: Manga[]) => void) | undefined;
    let resolveThirdPage: ((items: Manga[]) => void) | undefined;
    vi.mocked(getCollection).mockImplementation((page, order) => {
      if (order !== 'update') return Promise.resolve([]);
      if (page === 1) return Promise.resolve(createMangaPage(100));
      if (page === 2) {
        return new Promise<Manga[]>((resolve) => {
          resolveSecondPage = resolve;
        });
      }
      return new Promise<Manga[]>((resolve) => {
        resolveThirdPage = resolve;
      });
    });

    render(<App />);
    await waitFor(() => expect(screen.getByTestId('manga-100')).toBeTruthy());
    await waitFor(() => expect(getCollection).toHaveBeenCalledTimes(4));
    expect(screen.queryByRole('button', { name: 'さらに読み込む' })).toBeNull();

    await act(async () => resolveSecondPage?.(createMangaPage(200)));
    const loadMore = await screen.findByRole('button', { name: 'さらに読み込む' });
    expect(getCollection).toHaveBeenCalledTimes(4);

    fireEvent.click(loadMore);
    expect(screen.getByTestId('manga-200')).toBeTruthy();
    expect(document.querySelector('.loading-row')).toBeNull();
    expect(screen.queryByRole('button', { name: 'さらに読み込む' })).toBeNull();
    await waitFor(() => expect(getCollection).toHaveBeenCalledTimes(5));
    expect(getCollection).toHaveBeenLastCalledWith(3, 'update', 24);

    await act(async () => resolveThirdPage?.([]));
  });

  it('prefetches chapter edges only when opening a manga without reading history', async () => {
    const unreadManga = { ...restoredManga, id: 8, name: '未読の作品' };
    vi.mocked(getCollection).mockResolvedValueOnce([unreadManga]);
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('manga-8')).toBeTruthy());

    fireEvent.click(screen.getByTestId('manga-8').querySelector('.cover-button')!);

    await waitFor(() => expect(prefetchChapterEdges).toHaveBeenCalledOnce());
  });

  it('does not prefetch chapter edges when the manga already has reading history', async () => {
    vi.mocked(getCollection).mockResolvedValueOnce([restoredManga]);
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('manga-7')).toBeTruthy());

    fireEvent.click(screen.getByTestId('manga-7').querySelector('.cover-button')!);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: '復元された作品' })).toBeTruthy(),
    );

    expect(prefetchChapterEdges).not.toHaveBeenCalled();
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
    expect(screen.getByRole('heading', { name: 'マイライブラリ' })).toBeTruthy();
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
