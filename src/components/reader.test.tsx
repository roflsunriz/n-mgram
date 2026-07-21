// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Chapter, Manga } from '../api/client';
import { createTranslator } from '../i18n';
import { Reader } from './reader';

class IntersectionObserverStub {
  observe() {}
  disconnect() {}
}

vi.stubGlobal('IntersectionObserver', IntersectionObserverStub);
Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
  value: vi.fn(),
  configurable: true,
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

beforeEach(() => {
  const values = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
  vi.stubGlobal('localStorage', storage);
});

const manga: Manga = {
  id: 1,
  name: 'Test Manga',
  slug: 'test',
  authors: 'Author',
  transGroup: '',
  artists: '',
  released: 0,
  otherName: '',
  genres: '',
  description: '',
  mStatus: 2,
  lastUpdate: '',
  post: '',
  cover: 'https://ihlv1.xyz/cover.webp',
  lastChapter: '1',
  views: 0,
  submitter: 0,
  groupUploader: 0,
  hidden: 0,
  magazines: '',
};

const chapters: Chapter[] = [
  {
    mid: 1,
    name: 'Test Manga',
    chapter: 1,
    content: ['https://ihlv1.xyz/1.webp', 'https://ihlv1.xyz/2.webp', 'https://ihlv1.xyz/3.webp'],
    time: '',
    views: 0,
  },
];

const multipleChapters: Chapter[] = [
  chapters[0]!,
  {
    mid: 1,
    name: 'Test Manga',
    chapter: 2,
    content: ['https://ihlv1.xyz/2-1.webp', 'https://ihlv1.xyz/2-2.webp'],
    time: '',
    views: 0,
  },
];

describe('Reader', () => {
  it('shows right-bound spreads and advances with the left arrow', async () => {
    const onProgress = vi.fn();
    render(
      <Reader
        manga={manga}
        chapters={chapters}
        initialChapter={0}
        initialPage={0}
        onClose={vi.fn()}
        onProgress={onProgress}
        t={createTranslator('ja')}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'ページ読み' }));
    expect(screen.getByText('1 / 3')).toBeTruthy();
    await waitFor(() =>
      expect(document.querySelector('.spread-page-right')?.getAttribute('src')).toBe(
        'https://ihlv1.xyz/1.webp',
      ),
    );

    fireEvent.keyDown(window, { key: 'ArrowLeft' });

    expect(screen.getByText('2–3 / 3')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByRole('img', { name: '2' })).toBeTruthy();
      expect(screen.getByRole('img', { name: '3' })).toBeTruthy();
      expect(document.querySelector('.spread-page-right')?.getAttribute('src')).toBe(
        'https://ihlv1.xyz/2.webp',
      );
      expect(document.querySelector('.spread-page-left')?.getAttribute('src')).toBe(
        'https://ihlv1.xyz/3.webp',
      );
    });
    expect(onProgress).toHaveBeenLastCalledWith(chapters[0], 1);
  });

  it('closes with Escape', () => {
    const onClose = vi.fn();
    render(
      <Reader
        manga={manga}
        chapters={chapters}
        initialChapter={0}
        initialPage={0}
        onClose={onClose}
        onProgress={vi.fn()}
        t={createTranslator('ja')}
      />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('hides idle controls and reveals them on pointer movement', () => {
    vi.useFakeTimers();
    render(
      <Reader
        manga={manga}
        chapters={chapters}
        initialChapter={0}
        initialPage={0}
        onClose={vi.fn()}
        onProgress={vi.fn()}
        t={createTranslator('ja')}
      />,
    );
    const reader = screen.getByTestId('reader');
    expect(reader.classList.contains('controls-visible')).toBe(true);

    act(() => vi.advanceTimersByTime(2_500));
    expect(reader.classList.contains('controls-hidden')).toBe(true);

    fireEvent.pointerMove(reader, { pointerType: 'mouse' });
    expect(reader.classList.contains('controls-visible')).toBe(true);
  });

  it('uses one page in compact portrait and advances with a left swipe', async () => {
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });

    try {
      render(
        <Reader
          manga={manga}
          chapters={chapters}
          initialChapter={0}
          initialPage={0}
          onClose={vi.fn()}
          onProgress={vi.fn()}
          t={createTranslator('ja')}
        />,
      );

      fireEvent.click(screen.getByTestId('reader-mode-paged'));
      expect(document.querySelector('.reader-spread')?.classList.contains('is-single-page')).toBe(
        true,
      );
      expect(screen.getByText('1 / 3')).toBeTruthy();

      const stage = document.querySelector('.reader-stage');
      expect(stage).toBeTruthy();
      fireEvent.pointerDown(stage!, {
        pointerId: 1,
        isPrimary: true,
        clientX: 240,
        clientY: 100,
      });
      fireEvent.pointerUp(stage!, {
        pointerId: 1,
        isPrimary: true,
        clientX: 120,
        clientY: 100,
      });

      expect(screen.getByText('2 / 3')).toBeTruthy();
      await waitFor(() => expect(screen.getByRole('img', { name: '2' })).toBeTruthy());
    } finally {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: originalMatchMedia,
      });
    }
  });

  it('restores the selected reader mode and fit across reader sessions', async () => {
    const firstSession = render(
      <Reader
        manga={manga}
        chapters={chapters}
        initialChapter={0}
        initialPage={0}
        onClose={vi.fn()}
        onProgress={vi.fn()}
        t={createTranslator('ja')}
      />,
    );

    fireEvent.click(screen.getByTestId('reader-mode-paged'));
    fireEvent.change(screen.getByTestId('reader-fit'), { target: { value: 'height' } });
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem('n-mgram.reader-settings') ?? '{}')).toMatchObject({
        mode: 'paged',
        fit: 'height',
      }),
    );
    firstSession.unmount();

    render(
      <Reader
        manga={manga}
        chapters={chapters}
        initialChapter={0}
        initialPage={0}
        onClose={vi.fn()}
        onProgress={vi.fn()}
        t={createTranslator('ja')}
      />,
    );

    expect(screen.getByTestId('reader-mode-paged').classList.contains('active')).toBe(true);
    expect((screen.getByTestId('reader-fit') as HTMLSelectElement).value).toBe('height');
    expect(document.querySelector('.reader-stage')?.classList.contains('mode-paged')).toBe(true);
    expect(document.querySelector('.reader-stage')?.classList.contains('fit-height')).toBe(true);
  });

  it('navigates chapters from both the header and the end-of-chapter controls', () => {
    render(
      <Reader
        manga={manga}
        chapters={multipleChapters}
        initialChapter={0}
        initialPage={0}
        onClose={vi.fn()}
        onProgress={vi.fn()}
        t={createTranslator('ja')}
      />,
    );

    const chapterSelect = screen.getByRole('combobox', { name: '章' }) as HTMLSelectElement;
    fireEvent.click(screen.getByTestId('reader-next-chapter-header'));
    expect(chapterSelect.value).toBe('1');

    fireEvent.click(screen.getByTestId('reader-previous-chapter-footer'));
    expect(chapterSelect.value).toBe('0');
    expect(screen.getByText('この章の最後です')).toBeTruthy();
  });

  it('keeps nearby paged images mounted and preloaded while only showing the active spread', async () => {
    render(
      <Reader
        manga={manga}
        chapters={chapters}
        initialChapter={0}
        initialPage={0}
        onClose={vi.fn()}
        onProgress={vi.fn()}
        t={createTranslator('ja')}
      />,
    );
    fireEvent.click(screen.getByTestId('reader-mode-paged'));

    await waitFor(() => {
      const prefetched = document.querySelectorAll('.paged-image-prefetch[hidden]');
      expect(prefetched).toHaveLength(2);
      expect([...prefetched].every((element) => element.getAttribute('src'))).toBe(true);
    });
  });
});
