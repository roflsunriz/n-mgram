// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Chapter, Manga } from '../api/client';
import { createTranslator } from '../i18n';
import { Reader } from './reader';

const windowApi = vi.hoisted(() => ({
  state: { fullscreen: false },
  isFullscreen: vi.fn(async () => false),
  setFullscreen: vi.fn(async (value: boolean) => {
    void value;
  }),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => windowApi,
}));

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
  Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
  vi.useRealTimers();
});

beforeEach(() => {
  windowApi.state.fullscreen = false;
  windowApi.isFullscreen.mockReset().mockImplementation(async () => windowApi.state.fullscreen);
  windowApi.setFullscreen.mockReset().mockImplementation(async (value: boolean) => {
    windowApi.state.fullscreen = value;
  });
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

  it('toggles Windows fullscreen from the header and F11', async () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      configurable: true,
    });
    Object.defineProperty(window, '__TAURI_INTERNALS__', { value: {}, configurable: true });

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

    const button = await screen.findByTestId('reader-fullscreen');
    fireEvent.click(button);
    await waitFor(() => expect(windowApi.setFullscreen).toHaveBeenCalledWith(true));
    expect(button.getAttribute('aria-label')).toBe('全画面表示を終了（F11）');

    fireEvent.keyDown(window, { key: 'F11' });
    await waitFor(() => expect(windowApi.setFullscreen).toHaveBeenLastCalledWith(false));
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
    const stage = document.querySelector('.reader-stage') as HTMLDivElement;
    expect(reader.classList.contains('controls-visible')).toBe(true);
    expect(stage.style.top).toBe('0px');

    act(() => vi.advanceTimersByTime(2_500));
    expect(reader.classList.contains('controls-hidden')).toBe(true);
    expect(stage.style.top).toBe('0px');

    fireEvent.pointerMove(reader, { pointerType: 'mouse' });
    expect(reader.classList.contains('controls-visible')).toBe(true);
    expect(stage.style.top).toBe('0px');
  });

  it('keeps hidden controls suppressed while turning pages', () => {
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
    fireEvent.click(screen.getByTestId('reader-mode-paged'));
    const reader = screen.getByTestId('reader');
    const help = document.querySelector('.reader-help')!;
    act(() => vi.advanceTimersByTime(2_500));

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText('2–3 / 3')).toBeTruthy();
    expect(reader.classList.contains('controls-hidden')).toBe(true);
    expect(help.classList.contains('is-hidden')).toBe(true);

    const previousPage = screen.getByRole('button', { name: '前へ' });
    fireEvent.focus(previousPage);
    fireEvent.click(previousPage);
    expect(screen.getByText('1 / 3')).toBeTruthy();
    expect(reader.classList.contains('controls-hidden')).toBe(true);
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

  it('pinch-zooms around touch pointers without turning the page', () => {
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
    const stage = document.querySelector('.reader-stage')!;
    const surface = screen.getByTestId('reader-zoom-surface');

    fireEvent.pointerDown(stage, {
      pointerId: 1,
      pointerType: 'touch',
      isPrimary: true,
      clientX: 100,
      clientY: 200,
    });
    fireEvent.pointerDown(stage, {
      pointerId: 2,
      pointerType: 'touch',
      isPrimary: false,
      clientX: 200,
      clientY: 200,
    });
    fireEvent.pointerMove(stage, {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 300,
      clientY: 200,
    });

    expect(surface.style.getPropertyValue('--reader-zoom')).toBe('2');
    expect(screen.getByTestId('reader-zoom-reset').textContent).toBe('200%');
    expect(screen.getByText('1 / 3')).toBeTruthy();

    fireEvent.pointerUp(stage, { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 200 });
    fireEvent.pointerUp(stage, { pointerId: 2, pointerType: 'touch', clientX: 300, clientY: 200 });
  });

  it('double-taps to zoom in and double-taps again to return to 100%', () => {
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
    const stage = document.querySelector('.reader-stage')!;
    const tap = (pointerId: number) => {
      fireEvent.pointerDown(stage, {
        pointerId,
        pointerType: 'touch',
        isPrimary: true,
        clientX: 80,
        clientY: 180,
      });
      fireEvent.pointerUp(stage, {
        pointerId,
        pointerType: 'touch',
        isPrimary: true,
        clientX: 80,
        clientY: 180,
      });
    };

    tap(1);
    tap(2);
    expect(screen.getByTestId('reader-zoom-surface').style.getPropertyValue('--reader-zoom')).toBe(
      '2.5',
    );
    expect(screen.getByText('1 / 3')).toBeTruthy();

    tap(3);
    tap(4);
    expect(screen.getByTestId('reader-zoom-surface').style.getPropertyValue('--reader-zoom')).toBe(
      '1',
    );
  });

  it('supports Windows-friendly zoom buttons and Ctrl-wheel trackpad zoom', () => {
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
    const surface = screen.getByTestId('reader-zoom-surface');
    const stage = document.querySelector('.reader-stage')!;

    fireEvent.click(screen.getByRole('button', { name: '拡大' }));
    expect(surface.style.getPropertyValue('--reader-zoom')).toBe('1.5');
    expect(screen.getByTestId('reader-zoom-reset').textContent).toBe('150%');

    fireEvent.wheel(stage, { ctrlKey: true, deltaY: -100, clientX: 240, clientY: 200 });
    expect(Number(surface.style.getPropertyValue('--reader-zoom'))).toBeGreaterThan(1.5);

    fireEvent.click(screen.getByTestId('reader-zoom-reset'));
    expect(surface.style.getPropertyValue('--reader-zoom')).toBe('1');

    fireEvent.keyDown(window, { key: '+', ctrlKey: true });
    expect(surface.style.getPropertyValue('--reader-zoom')).toBe('1.5');
    fireEvent.keyDown(window, { key: '-', ctrlKey: true });
    expect(surface.style.getPropertyValue('--reader-zoom')).toBe('1');
    fireEvent.keyDown(window, { key: '=', ctrlKey: true });
    fireEvent.keyDown(window, { key: '0', ctrlKey: true });
    expect(surface.style.getPropertyValue('--reader-zoom')).toBe('1');
  });

  it.each([
    { pointerType: 'mouse', label: 'Windows mouse' },
    { pointerType: 'touch', label: 'Android touch' },
  ])('pans a zoomed page by dragging with $label', async ({ pointerType }) => {
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
    fireEvent.click(screen.getByRole('button', { name: '拡大' }));

    const stage = document.querySelector('.reader-stage') as HTMLDivElement;
    const scrollTo = vi.mocked(stage.scrollTo);
    await waitFor(() => expect(scrollTo).toHaveBeenCalled());
    scrollTo.mockClear();

    fireEvent.pointerDown(stage, {
      pointerId: 1,
      pointerType,
      isPrimary: true,
      button: 0,
      clientX: 240,
      clientY: 220,
    });
    fireEvent.pointerMove(stage, {
      pointerId: 1,
      pointerType,
      isPrimary: true,
      buttons: 1,
      clientX: 140,
      clientY: 100,
    });

    await waitFor(() =>
      expect(scrollTo).toHaveBeenLastCalledWith({
        left: 100,
        top: 120,
      }),
    );
    fireEvent.pointerUp(stage, {
      pointerId: 1,
      pointerType,
      isPrimary: true,
      button: 0,
      clientX: 140,
      clientY: 100,
    });

    expect(screen.getByText('1 / 3')).toBeTruthy();
  });

  it('changes chapters with horizontal swipes in continuous mode', () => {
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
    const stage = document.querySelector('.reader-stage')!;
    const chapterSelect = screen.getByRole('combobox', { name: '章' }) as HTMLSelectElement;
    const swipe = (startX: number, endX: number, pointerId: number) => {
      fireEvent.pointerDown(stage, {
        pointerId,
        pointerType: 'touch',
        isPrimary: true,
        clientX: startX,
        clientY: 180,
      });
      fireEvent.pointerUp(stage, {
        pointerId,
        pointerType: 'touch',
        isPrimary: true,
        clientX: endX,
        clientY: 180,
      });
    };

    swipe(240, 120, 1);
    expect(chapterSelect.value).toBe('1');
    expect(document.querySelector('.reader-title span')?.textContent).toBe('第2話');

    swipe(120, 240, 2);
    expect(chapterSelect.value).toBe('0');
    expect(document.querySelector('.reader-title span')?.textContent).toBe('第1話');
  });

  it('reloads the first continuous page after pulling down at the top', async () => {
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
    const stage = document.querySelector('.reader-stage') as HTMLDivElement;
    const originalFirstPage = await screen.findByRole('img', { name: '1' });

    fireEvent.touchStart(stage, { touches: [{ identifier: 1, clientY: 100 }] });
    fireEvent.touchMove(stage, { touches: [{ identifier: 1, clientY: 180 }] });
    fireEvent.touchEnd(stage, { touches: [] });

    await waitFor(() => expect(screen.getByRole('img', { name: '1' })).not.toBe(originalFirstPage));
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
    const headerSelector = document.querySelector('.reader-chapter-selector');
    expect(headerSelector?.children[0]).toBe(screen.getByTestId('reader-next-chapter-header'));
    expect(headerSelector?.children[2]).toBe(screen.getByTestId('reader-previous-chapter-header'));
    fireEvent.click(screen.getByTestId('reader-next-chapter-header'));
    expect(chapterSelect.value).toBe('1');

    const footerNavigation = document.querySelector('.reader-chapter-footer');
    expect(footerNavigation?.children[0]).toBe(screen.getByTestId('reader-next-chapter-footer'));
    expect(footerNavigation?.children[2]).toBe(
      screen.getByTestId('reader-previous-chapter-footer'),
    );
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
