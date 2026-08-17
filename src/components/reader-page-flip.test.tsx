// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReaderPageFlip } from './reader-page-flip';

vi.mock('./page-image', () => ({
  PageImage: ({
    url,
    alt,
    className,
    pageIndex,
  }: {
    url: string;
    alt: string;
    className: string;
    pageIndex?: number;
  }) => <img src={url} alt={alt} className={className} data-page-index={pageIndex} />,
}));

class ResizeObserverStub {
  observe() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get: () => 1_200,
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get: () => 800,
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const pageUrls = [
  'https://ihlv1.xyz/1.webp',
  'https://ihlv1.xyz/2.webp',
  'https://ihlv1.xyz/3.webp',
];

describe('ReaderPageFlip', () => {
  it('loads validated HTML pages into a forced RTL landscape book', () => {
    render(
      <ReaderPageFlip
        pageUrls={pageUrls}
        activePageIndex={0}
        fit="width"
        loadFailedLabel="failed"
        retryLabel="retry"
        endPage={<span>finished</span>}
        onBlocked={vi.fn()}
        onPageChange={vi.fn()}
      />,
    );

    const root = screen.getByTestId('reader-page-flip');
    expect(root.getAttribute('data-page-flip-2-reading-direction')).toBe('rtl');
    expect(root.querySelector('.page-flip-2__wrapper.--landscape')).toBeTruthy();
    expect(root.querySelectorAll('[data-reader-page-flip-page]')).toHaveLength(4);
    expect(root.querySelector('.page-flip-2__item.--right')?.getAttribute('data-page-index')).toBe(
      '0',
    );
    expect(root.querySelector('.page-flip-2__item.--left')?.getAttribute('data-page-index')).toBe(
      '1',
    );
  });

  it('pairs an odd final manga page with the end page and restores DOM on unmount', () => {
    const view = render(
      <ReaderPageFlip
        pageUrls={pageUrls}
        activePageIndex={2}
        fit="height"
        loadFailedLabel="failed"
        retryLabel="retry"
        endPage={<span>finished</span>}
        onBlocked={vi.fn()}
        onPageChange={vi.fn()}
      />,
    );

    const root = screen.getByTestId('reader-page-flip');
    expect(root.querySelector('.page-flip-2__item.--right')?.getAttribute('data-page-index')).toBe(
      '2',
    );
    expect(root.querySelector('.page-flip-2__item.--left')?.getAttribute('data-page-index')).toBe(
      '3',
    );
    expect(screen.getByText('finished')).toBeTruthy();

    view.unmount();
    expect(document.querySelector('.page-flip-2__wrapper')).toBeNull();
  });
});
