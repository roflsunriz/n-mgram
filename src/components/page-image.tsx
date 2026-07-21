import { useEffect, useRef, useState } from 'react';
import { resolvePageImage } from '../api/client';

interface Props {
  url: string;
  alt: string;
  className: string;
  eager?: boolean;
  hidden?: boolean;
  onBlocked: (url: string) => void;
  onVisible?: () => void;
}

const PAGE_PRELOAD_MARGIN = '3000px 0px';

export function PageImage({
  url,
  alt,
  className,
  eager = false,
  hidden = false,
  onBlocked,
  onVisible,
}: Props) {
  const elementRef = useRef<HTMLElement>(null);
  const [loadRequested, setLoadRequested] = useState(eager);
  const [source, setSource] = useState<string>();
  const [failed, setFailed] = useState(false);

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
    let revoke: (() => void) | undefined;

    void resolvePageImage(url, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) {
          result.revoke?.();
          return;
        }
        if (result.blocked) {
          onBlocked(url);
          return;
        }
        revoke = result.revoke;
        setSource(result.source);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });

    return () => {
      controller.abort();
      revoke?.();
    };
  }, [loadRequested, onBlocked, url]);

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
      aria-hidden="true"
    />
  );
}
