// @vitest-environment jsdom
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolvePageImage } from '../api/client';
import { PageImage } from './page-image';

vi.mock('../api/client', () => ({
  resolvePageImage: vi.fn(async (url: string) => ({ blocked: false, source: url })),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
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
        onBlocked={onBlocked}
      />,
    );
    expect(options?.rootMargin).toBe('3000px 0px');
    expect(resolvePageImage).not.toHaveBeenCalled();

    view.rerender(
      <PageImage
        className="reader-image"
        url="https://ihlv1.xyz/page.webp"
        alt="1"
        eager
        onBlocked={onBlocked}
      />,
    );
    await waitFor(() => expect(resolvePageImage).toHaveBeenCalledOnce());
  });
});
