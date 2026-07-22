import { useEffect, useRef, useState } from 'react';
import { PageImageError } from '../api/client';
import { acquirePageImage, invalidatePageImageCache } from '../services/page-image-cache';

interface Props {
  url: string;
  alt: string;
  className: string;
  eager?: boolean;
  hidden?: boolean;
  pageIndex?: number;
  loadFailedLabel: string;
  retryLabel: string;
  onBlocked: (url: string) => void;
  onVisible?: () => void;
}

const PAGE_PRELOAD_MARGIN = '12000px 0px';
const RETRY_DELAYS_MS = [600, 1_800];
const MAX_DECODE_RETRIES = 1;

function waitForRetry(delay: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      window.clearTimeout(timeout);
      reject(new DOMException('Image load aborted', 'AbortError'));
    };
    const timeout = window.setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, delay);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export function PageImage({
  url,
  alt,
  className,
  eager = false,
  hidden = false,
  pageIndex,
  loadFailedLabel,
  retryLabel,
  onBlocked,
  onVisible,
}: Props) {
  const elementRef = useRef<HTMLElement>(null);
  const [loadRequested, setLoadRequested] = useState(eager);
  const [source, setSource] = useState<string>();
  const [failed, setFailed] = useState(false);
  const [loadGeneration, setLoadGeneration] = useState(0);
  const decodeRetriesRef = useRef(0);

  useEffect(() => {
    decodeRetriesRef.current = 0;
  }, [url]);

  useEffect(() => {
    if (!eager) return;
    // 先読み対象になった画像は、対象範囲を外れても読み込み結果を保持する。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadRequested(true);
  }, [eager]);

  useEffect(() => {
    if (loadRequested) return;
    const element = elementRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setLoadRequested(true);
      },
      { rootMargin: PAGE_PRELOAD_MARGIN },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [loadRequested]);

  useEffect(() => {
    if (!loadRequested) return;
    const controller = new AbortController();
    let release: (() => void) | undefined;

    void (async () => {
      for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
        try {
          const result = await acquirePageImage(url, controller.signal);
          if (controller.signal.aborted) {
            result.release();
            return;
          }
          if (result.blocked) {
            onBlocked(url);
            return;
          }
          if (!result.source) throw new PageImageError('Image source is missing.', false);
          release = result.release;
          setSource(result.source);
          return;
        } catch (error: unknown) {
          if (controller.signal.aborted) return;
          const delay = RETRY_DELAYS_MS[attempt];
          const retryable = !(error instanceof PageImageError) || error.retryable;
          if (!retryable || delay === undefined) {
            setFailed(true);
            return;
          }
          try {
            await waitForRetry(delay, controller.signal);
          } catch {
            return;
          }
        }
      }
    })();

    return () => {
      controller.abort();
      release?.();
    };
  }, [loadGeneration, loadRequested, onBlocked, url]);

  useEffect(() => {
    if (!source || !onVisible) return;
    const element = elementRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && entry.intersectionRatio >= 0.45) onVisible();
      },
      { threshold: [0.45, 0.75] },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [onVisible, source]);

  if (source) {
    return (
      <img
        ref={elementRef as React.RefObject<HTMLImageElement>}
        className={className}
        src={source}
        alt={alt}
        decoding="async"
        data-page-index={pageIndex}
        onError={() => {
          invalidatePageImageCache(url);
          setSource(undefined);
          if (decodeRetriesRef.current < MAX_DECODE_RETRIES) {
            decodeRetriesRef.current += 1;
            setLoadGeneration((value) => value + 1);
          } else {
            setFailed(true);
          }
        }}
        hidden={hidden}
        aria-hidden={hidden || undefined}
      />
    );
  }

  return (
    <div
      ref={elementRef as React.RefObject<HTMLDivElement>}
      className={`${className} page-image-placeholder ${failed ? 'is-failed' : ''}`}
      hidden={hidden}
      data-page-index={pageIndex}
      aria-hidden={failed ? undefined : true}
      aria-label={failed ? loadFailedLabel : undefined}
      aria-live={failed ? 'polite' : undefined}
    >
      {failed && (
        <div className="page-image-error">
          <span>{loadFailedLabel}</span>
          <button
            type="button"
            className="page-image-retry"
            onPointerUp={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              decodeRetriesRef.current = 0;
              setFailed(false);
              setSource(undefined);
              setLoadGeneration((value) => value + 1);
            }}
          >
            {retryLabel}
          </button>
        </div>
      )}
    </div>
  );
}
