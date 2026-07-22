// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PageImageError, resolvePageImage } from '../api/client';
import { clearPageImageCache } from '../services/page-image-cache';
import { PageImage } from './page-image';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    resolvePageImage: vi.fn(async (url: string) => ({ blocked: false, source: url })),
  };
});

const labels = {
  loadFailedLabel: '画像を読み込めませんでした',
  retryLabel: '画像を再読み込み',
};

afterEach(async () => {
  cleanup();
  await clearPageImageCache();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('PageImage preloading', () => {
  it('observes a wider offscreen margin and starts loading when it becomes eager', async () => {
    let options: IntersectionObserverInit | undefined;
    class ObserverStub {
      constructor(
        _callback: IntersectionObserverCallback,
        observerOptions?: IntersectionObserverInit,
      ) {
        options = observerOptions;
      }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal('IntersectionObserver', ObserverStub);

    const onBlocked = vi.fn();
    const view = render(
      <PageImage
        className="reader-image"
        url="https://ihlv1.xyz/page.webp"
        alt="1"
        {...labels}
        onBlocked={onBlocked}
      />,
    );
    expect(options?.rootMargin).toBe('12000px 0px');
    expect(resolvePageImage).not.toHaveBeenCalled();

    view.rerender(
      <PageImage
        className="reader-image"
        url="https://ihlv1.xyz/page.webp"
        alt="1"
        eager
        {...labels}
        onBlocked={onBlocked}
      />,
    );
    await waitFor(() => expect(resolvePageImage).toHaveBeenCalledOnce());
  });

  it('retries transient failures automatically', async () => {
    vi.useFakeTimers();
    vi.mocked(resolvePageImage)
      .mockRejectedValueOnce(new PageImageError('temporary', true))
      .mockRejectedValueOnce(new PageImageError('temporary', true))
      .mockResolvedValueOnce({ blocked: false, source: 'blob:loaded' });

    render(
      <PageImage
        className="reader-image"
        url="https://ihlv1.xyz/retry.webp"
        alt="2"
        eager
        {...labels}
        onBlocked={vi.fn()}
      />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_500);
    });
    expect(resolvePageImage).toHaveBeenCalledTimes(3);
    expect(screen.getByRole('img').getAttribute('src')).toBe('blob:loaded');
  });

  it('offers manual reload after a final failure', async () => {
    vi.mocked(resolvePageImage).mockRejectedValueOnce(new PageImageError('invalid', false));
    const onSettled = vi.fn();
    render(
      <PageImage
        className="reader-image"
        url="https://ihlv1.xyz/manual.webp"
        alt="3"
        eager
        {...labels}
        onBlocked={vi.fn()}
        onSettled={onSettled}
      />,
    );

    const retry = await screen.findByRole('button', { name: labels.retryLabel });
    expect(onSettled).toHaveBeenCalledOnce();
    vi.mocked(resolvePageImage).mockResolvedValueOnce({ blocked: false, source: 'blob:reloaded' });
    fireEvent.click(retry);

    await waitFor(() => expect(screen.getByRole('img').getAttribute('src')).toBe('blob:reloaded'));
  });

  it('reports when the loaded image has finished decoding', async () => {
    const onSettled = vi.fn();
    render(
      <PageImage
        className="reader-image"
        url="https://ihlv1.xyz/settled.webp"
        alt="4"
        eager
        {...labels}
        onBlocked={vi.fn()}
        onSettled={onSettled}
      />,
    );

    const image = await screen.findByRole('img');
    expect(onSettled).not.toHaveBeenCalled();
    fireEvent.load(image);
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it('reuses the cached source after leaving and reopening the same page', async () => {
    const url = 'https://ihlv1.xyz/reopen.webp';
    const first = render(
      <PageImage
        className="reader-image"
        url={url}
        alt="4"
        eager
        {...labels}
        onBlocked={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByRole('img')).toBeTruthy());
    first.unmount();

    render(
      <PageImage
        className="reader-image"
        url={url}
        alt="4"
        eager
        {...labels}
        onBlocked={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByRole('img')).toBeTruthy());

    expect(resolvePageImage).toHaveBeenCalledOnce();
  });
});
