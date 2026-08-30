import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { DisplayMode, PageFlip, ReadingDirection, SizeType } from 'page-flip-2';
import type { ReaderFitMode } from '../storage/reader-settings-store';
import { PageImage } from './page-image';
import { installRtlLandscapeTexturePairing } from './page-flip-texture-pairing';
import { getReaderSpread } from './reader-spread';

const PAGE_WIDTH = 720;
const PAGE_HEIGHT = 1_024;
const FLIPPING_TIME_MS = 520;

interface Props {
  pageUrls: readonly string[];
  activePageIndex: number;
  fit: ReaderFitMode;
  loadFailedLabel: string;
  retryLabel: string;
  endPage: ReactNode;
  onBlocked: (url: string) => void;
  onPageChange: (pageIndex: number) => void;
}

export function ReaderPageFlip({
  pageUrls,
  activePageIndex,
  fit,
  loadFailedLabel,
  retryLabel,
  endPage,
  onBlocked,
  onPageChange,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pageFlipRef = useRef<PageFlip | undefined>(undefined);
  const initialPageRef = useRef(activePageIndex);
  const initialPageCountRef = useRef(pageUrls.length);
  const onPageChangeRef = useRef(onPageChange);
  const hasEndPage = pageUrls.length > 0 && pageUrls.length % 2 === 1;
  const renderedPageCount = pageUrls.length + (hasEndPage ? 1 : 0);
  const visibleSpread = getReaderSpread(activePageIndex, renderedPageCount);

  useEffect(() => {
    onPageChangeRef.current = onPageChange;
  }, [onPageChange]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (root === null || initialPageCountRef.current === 0) return;

    const pageFlip = new PageFlip(root, {
      size: SizeType.STRETCH,
      displayMode: DisplayMode.LANDSCAPE,
      readingDirection: ReadingDirection.RTL,
      startPage: initialPageRef.current,
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
      minWidth: 100,
      maxWidth: 650,
      minHeight: 140,
      maxHeight: PAGE_HEIGHT,
      autoSize: false,
      usePortrait: false,
      useMouseEvents: false,
      showPageCorners: false,
      drawShadow: true,
      maxShadowOpacity: 0.45,
      flippingTime: FLIPPING_TIME_MS,
    });
    pageFlipRef.current = pageFlip;
    pageFlip.on<number>('flip', ({ data }) => {
      if (data < initialPageCountRef.current) onPageChangeRef.current(data);
    });
    pageFlip.loadFromHTML(root.querySelectorAll<HTMLElement>('[data-reader-page-flip-page]'));
    const restoreTexturePairing = installRtlLandscapeTexturePairing(pageFlip);

    return () => {
      pageFlipRef.current = undefined;
      restoreTexturePairing();
      pageFlip.off('flip');
      pageFlip.destroy();
    };
  }, []);

  useEffect(() => {
    const pageFlip = pageFlipRef.current;
    if (pageFlip === undefined || pageUrls.length === 0) return;

    const displayed = getReaderSpread(pageFlip.getCurrentPageIndex(), renderedPageCount);
    const requested = getReaderSpread(activePageIndex, renderedPageCount);
    if (displayed.start !== requested.start) pageFlip.flip(requested.start);
  }, [activePageIndex, pageUrls.length, renderedPageCount]);

  return (
    <div
      ref={rootRef}
      className={`reader-page-flip reader-page-flip-fit-${fit}`}
      data-testid="reader-page-flip"
    >
      {pageUrls.map((url, index) => {
        const isLeft = visibleSpread.left === index;
        const isRight = visibleSpread.right === index;
        const isVisible = isLeft || isRight;
        const eager =
          index >= Math.max(0, visibleSpread.start - 2) && index <= visibleSpread.end + 4;
        return (
          <div
            key={`${url}-${index}`}
            className="reader-page-flip-page"
            data-reader-page-flip-page
            data-page-index={index}
            data-page-eager={eager || undefined}
            aria-hidden={!isVisible || undefined}
          >
            <PageImage
              className={`reader-image paged-image ${
                isLeft ? 'spread-page-left' : isRight ? 'spread-page-right' : 'paged-image-prefetch'
              }`}
              url={url}
              alt={`${index + 1}`}
              pageIndex={index}
              eager={eager}
              loadFailedLabel={loadFailedLabel}
              retryLabel={retryLabel}
              onBlocked={onBlocked}
            />
          </div>
        );
      })}
      {hasEndPage && (
        <div
          className="reader-page-flip-page reader-page-flip-end-page"
          data-reader-page-flip-page
          data-page-index={pageUrls.length}
          aria-hidden={visibleSpread.left !== pageUrls.length || undefined}
        >
          {endPage}
        </div>
      )}
    </div>
  );
}
