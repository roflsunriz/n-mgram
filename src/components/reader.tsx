import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { Chapter, Manga } from '../api/client';
import type { MessageKey } from '../i18n';
import { invalidatePageImageCache } from '../services/page-image-cache';
import { prefetchReaderPages } from '../services/reader-prefetch';
import {
  loadReaderSettings,
  saveReaderSettings,
  type ReaderFitMode,
} from '../storage/reader-settings-store';
import { ArrowLeftIcon, ArrowRightIcon, BookIcon, CloseIcon, FullscreenIcon } from './icons';
import { PageImage } from './page-image';
import { ReaderPullRefreshIndicator, useReaderPullRefresh } from './reader-pull-refresh';
import {
  getLastSpreadStart,
  getNextSpreadStart,
  getPreviousSpreadStart,
  getReaderSpread,
} from './reader-spread';

const CONTROLS_HIDE_DELAY_MS = 2_500;
const SWIPE_THRESHOLD_PX = 56;
const TAP_MOVEMENT_TOLERANCE_PX = 10;
const TAP_MAX_DURATION_MS = 500;
const DOUBLE_TAP_DELAY_MS = 280;
const DOUBLE_TAP_DISTANCE_PX = 36;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const DOUBLE_TAP_ZOOM = 2.5;
const ZOOM_STEP = 0.5;
const SINGLE_PAGE_QUERY = '(max-width: 620px) and (orientation: portrait)';

interface PointerPosition {
  x: number;
  y: number;
}

interface PinchGesture {
  pointerIds: readonly [number, number];
  startDistance: number;
  startZoom: number;
  surfaceOriginX: number;
  surfaceOriginY: number;
  anchorContentX: number;
  anchorContentY: number;
}

interface Props {
  manga: Manga;
  chapters: Chapter[];
  initialChapter: number;
  initialPage: number;
  onClose: () => void;
  onProgress: (chapter: Chapter, page: number) => void;
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
}

export function Reader({
  manga,
  chapters,
  initialChapter,
  initialPage,
  onClose,
  onProgress,
  t,
}: Props) {
  const [chapterIndex, setChapterIndex] = useState(initialChapter);
  const [pageIndex, setPageIndex] = useState(initialPage);
  const [readerSettings, setReaderSettings] = useState(loadReaderSettings);
  const { mode, fit } = readerSettings;
  const [singlePage, setSinglePage] = useState(isCompactPortrait);
  const [blockedPageUrls, setBlockedPageUrls] = useState<ReadonlySet<string>>(() => new Set());
  const [controlsVisible, setControlsVisible] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [firstPageReloadGeneration, setFirstPageReloadGeneration] = useState(0);
  const windowsFullscreenAvailable = isWindowsTauriApp();
  const chapter = chapters[chapterIndex];
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialScrollAppliedRef = useRef(false);
  const toolbarRef = useRef<HTMLElement>(null);
  const controlsTimerRef = useRef<number | undefined>(undefined);
  const pointerInToolbarRef = useRef(false);
  const fullscreenRef = useRef(false);
  const zoomRef = useRef(MIN_ZOOM);
  const zoomSurfaceRef = useRef<HTMLDivElement>(null);
  const zoomScrollFrameRef = useRef<number | undefined>(undefined);
  const activePointersRef = useRef(new Map<number, PointerPosition>());
  const pinchRef = useRef<PinchGesture | undefined>(undefined);
  const suppressTapRef = useRef(false);
  const lastTapRef = useRef<{ at: number; x: number; y: number } | undefined>(undefined);
  const pendingTapRef = useRef<
    | {
        timer: number;
        x: number;
        y: number;
      }
    | undefined
  >(undefined);
  const gestureRef = useRef<
    | {
        pointerId: number;
        pointerType: string;
        x: number;
        y: number;
        scrollLeft: number;
        scrollTop: number;
        startedAt: number;
      }
    | undefined
  >(undefined);
  const pageUrls = useMemo(
    () => chapter?.content.filter((url) => !blockedPageUrls.has(url)) ?? [],
    [blockedPageUrls, chapter],
  );
  const activePageIndex = Math.min(pageIndex, Math.max(0, pageUrls.length - 1));
  const markPageBlocked = useCallback((url: string) => {
    setBlockedPageUrls((current) => {
      if (current.has(url)) return current;
      return new Set([...current, url]);
    });
  }, []);

  const refreshFirstPage = useCallback(() => {
    const firstPageUrl = pageUrls[0];
    if (!firstPageUrl) return;
    invalidatePageImageCache(firstPageUrl);
    setFirstPageReloadGeneration((value) => value + 1);
  }, [pageUrls]);
  const pullRefresh = useReaderPullRefresh({
    enabled: mode === 'continuous' && zoom <= MIN_ZOOM + 0.01 && pageUrls.length > 0,
    onRefresh: refreshFirstPage,
  });

  const cancelControlsHide = useCallback(() => {
    if (controlsTimerRef.current !== undefined) {
      window.clearTimeout(controlsTimerRef.current);
      controlsTimerRef.current = undefined;
    }
  }, []);

  const scheduleControlsHide = useCallback(() => {
    cancelControlsHide();
    controlsTimerRef.current = window.setTimeout(() => {
      const focusedElement = document.activeElement;
      if (
        pointerInToolbarRef.current ||
        (focusedElement instanceof Node && toolbarRef.current?.contains(focusedElement))
      ) {
        return;
      }
      setControlsVisible(false);
    }, CONTROLS_HIDE_DELAY_MS);
  }, [cancelControlsHide]);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    scheduleControlsHide();
  }, [scheduleControlsHide]);

  const toggleControls = useCallback(() => {
    setControlsVisible((current) => {
      if (current) cancelControlsHide();
      else scheduleControlsHide();
      return !current;
    });
  }, [cancelControlsHide, scheduleControlsHide]);

  const queueStageScroll = useCallback((left: number, top: number) => {
    if (zoomScrollFrameRef.current !== undefined) {
      window.cancelAnimationFrame(zoomScrollFrameRef.current);
    }
    zoomScrollFrameRef.current = window.requestAnimationFrame(() => {
      zoomScrollFrameRef.current = undefined;
      scrollRef.current?.scrollTo({
        left: Math.max(0, left),
        top: Math.max(0, top),
      });
    });
  }, []);

  const setZoomAt = useCallback(
    (requestedZoom: number, clientX?: number, clientY?: number) => {
      const nextZoom = clampZoom(requestedZoom);
      const previousZoom = zoomRef.current;
      if (Math.abs(nextZoom - previousZoom) < 0.001) return;

      const stage = scrollRef.current;
      zoomRef.current = nextZoom;
      setZoom(nextZoom);
      if (!stage) return;

      const stageBounds = stage.getBoundingClientRect();
      const focalClientX = clientX ?? stageBounds.left + stageBounds.width / 2;
      const focalClientY = clientY ?? stageBounds.top + stageBounds.height / 2;
      const surfaceBounds = zoomSurfaceRef.current?.getBoundingClientRect();
      const surfaceLeft = surfaceBounds?.left ?? stageBounds.left - stage.scrollLeft;
      const surfaceTop =
        (surfaceBounds?.top ?? stageBounds.top - stage.scrollTop) - pullRefresh.pullOffset;
      const focalSurfaceX = focalClientX - surfaceLeft;
      const focalSurfaceY = focalClientY - surfaceTop;
      const zoomRatio = nextZoom / previousZoom;
      queueStageScroll(
        stage.scrollLeft + focalSurfaceX * (zoomRatio - 1),
        stage.scrollTop + focalSurfaceY * (zoomRatio - 1),
      );
    },
    [pullRefresh.pullOffset, queueStageScroll],
  );

  const resetZoom = useCallback(() => setZoomAt(MIN_ZOOM), [setZoomAt]);

  const resetZoomForLayout = useCallback(() => {
    if (zoomScrollFrameRef.current !== undefined) {
      window.cancelAnimationFrame(zoomScrollFrameRef.current);
      zoomScrollFrameRef.current = undefined;
    }
    zoomRef.current = MIN_ZOOM;
    setZoom(MIN_ZOOM);
    scrollRef.current?.scrollTo({ left: 0, top: 0 });
  }, []);

  const changeSpread = useCallback(
    (direction: 'next' | 'previous') => {
      if (!chapter) return;
      const nextPage = singlePage
        ? direction === 'next'
          ? activePageIndex + 1 < pageUrls.length
            ? activePageIndex + 1
            : undefined
          : activePageIndex > 0
            ? activePageIndex - 1
            : undefined
        : direction === 'next'
          ? getNextSpreadStart(activePageIndex, pageUrls.length)
          : getPreviousSpreadStart(activePageIndex, pageUrls.length);

      if (nextPage !== undefined) {
        setPageIndex(nextPage);
      } else if (direction === 'next' && chapterIndex < chapters.length - 1) {
        resetZoomForLayout();
        setChapterIndex((value) => value + 1);
        setPageIndex(0);
      } else if (direction === 'previous' && chapterIndex > 0) {
        const previous = chapters[chapterIndex - 1];
        const previousPageCount =
          previous?.content.filter((url) => !blockedPageUrls.has(url)).length ?? 0;
        resetZoomForLayout();
        setChapterIndex((value) => value - 1);
        setPageIndex(
          singlePage ? Math.max(0, previousPageCount - 1) : getLastSpreadStart(previousPageCount),
        );
      }
    },
    [
      activePageIndex,
      blockedPageUrls,
      chapter,
      chapterIndex,
      chapters,
      pageUrls.length,
      resetZoomForLayout,
      singlePage,
    ],
  );

  const runStageTap = useCallback(
    (clientX: number) => {
      if (mode !== 'paged' || zoomRef.current > MIN_ZOOM + 0.01) {
        toggleControls();
        return;
      }
      const bounds = scrollRef.current?.getBoundingClientRect();
      const relativeX = bounds && bounds.width > 0 ? (clientX - bounds.left) / bounds.width : 0.5;
      if (relativeX < 0.32) changeSpread('next');
      else if (relativeX > 0.68) changeSpread('previous');
      else toggleControls();
    },
    [changeSpread, mode, toggleControls],
  );

  const clearPendingTap = useCallback(() => {
    const pending = pendingTapRef.current;
    if (!pending) return;
    window.clearTimeout(pending.timer);
    pendingTapRef.current = undefined;
  }, []);

  const commitPendingTap = useCallback(() => {
    const pending = pendingTapRef.current;
    if (!pending) return;
    window.clearTimeout(pending.timer);
    pendingTapRef.current = undefined;
    lastTapRef.current = undefined;
    runStageTap(pending.x);
  }, [runStageTap]);

  const handleTouchTap = useCallback(
    (clientX: number, clientY: number) => {
      const now = performance.now();
      const previous = lastTapRef.current;
      if (
        previous &&
        now - previous.at <= DOUBLE_TAP_DELAY_MS &&
        Math.hypot(clientX - previous.x, clientY - previous.y) <= DOUBLE_TAP_DISTANCE_PX
      ) {
        clearPendingTap();
        lastTapRef.current = undefined;
        setZoomAt(zoomRef.current > MIN_ZOOM + 0.01 ? MIN_ZOOM : DOUBLE_TAP_ZOOM, clientX, clientY);
        return;
      }

      if (previous) commitPendingTap();
      lastTapRef.current = { at: now, x: clientX, y: clientY };
      const timer = window.setTimeout(() => {
        const pending = pendingTapRef.current;
        pendingTapRef.current = undefined;
        lastTapRef.current = undefined;
        if (pending) runStageTap(pending.x);
      }, DOUBLE_TAP_DELAY_MS);
      pendingTapRef.current = { timer, x: clientX, y: clientY };
    },
    [clearPendingTap, commitPendingTap, runStageTap, setZoomAt],
  );

  const changeFullscreen = useCallback(
    async (nextFullscreen?: boolean) => {
      if (!windowsFullscreenAvailable) return;
      const appWindow = getCurrentWindow();
      try {
        const next = nextFullscreen ?? !(await appWindow.isFullscreen());
        await appWindow.setFullscreen(next);
        fullscreenRef.current = next;
        setFullscreen(next);
      } catch {
        fullscreenRef.current = false;
        setFullscreen(false);
      }
    },
    [windowsFullscreenAvailable],
  );

  useEffect(() => {
    if (!window.matchMedia) return;
    const media = window.matchMedia(SINGLE_PAGE_QUERY);
    const updateLayout = () => setSinglePage(media.matches);
    updateLayout();
    media.addEventListener?.('change', updateLayout);
    return () => media.removeEventListener?.('change', updateLayout);
  }, []);

  useEffect(() => {
    if (!windowsFullscreenAvailable) return;
    let active = true;
    void getCurrentWindow()
      .isFullscreen()
      .then((value) => {
        if (!active) return;
        fullscreenRef.current = value;
        setFullscreen(value);
      })
      .catch(() => undefined);
    return () => {
      active = false;
      if (fullscreenRef.current)
        void getCurrentWindow()
          .setFullscreen(false)
          .catch(() => undefined);
    };
  }, [windowsFullscreenAvailable]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (windowsFullscreenAvailable && event.key === 'F11') {
        event.preventDefault();
        void changeFullscreen();
        return;
      }
      if (event.key === 'Escape') {
        if (fullscreenRef.current) void changeFullscreen(false);
        else onClose();
        return;
      }
      if (event.ctrlKey && (event.key === '+' || event.key === '=' || event.key === 'Add')) {
        event.preventDefault();
        setZoomAt(zoomRef.current + ZOOM_STEP);
        return;
      }
      if (event.ctrlKey && (event.key === '-' || event.key === 'Subtract')) {
        event.preventDefault();
        setZoomAt(zoomRef.current - ZOOM_STEP);
        return;
      }
      if (event.ctrlKey && event.key === '0') {
        event.preventDefault();
        resetZoom();
        return;
      }
      if (mode === 'paged' && event.key === 'ArrowLeft') changeSpread('next');
      if (mode === 'paged' && event.key === 'ArrowRight') changeSpread('previous');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    changeFullscreen,
    changeSpread,
    mode,
    onClose,
    resetZoom,
    setZoomAt,
    windowsFullscreenAvailable,
  ]);

  useEffect(() => {
    scheduleControlsHide();
    return () => {
      cancelControlsHide();
      clearPendingTap();
      if (zoomScrollFrameRef.current !== undefined) {
        window.cancelAnimationFrame(zoomScrollFrameRef.current);
      }
    };
  }, [cancelControlsHide, clearPendingTap, scheduleControlsHide]);

  useEffect(() => {
    saveReaderSettings(readerSettings);
  }, [readerSettings]);

  useEffect(() => {
    const controller = new AbortController();
    void prefetchReaderPages(chapters, chapterIndex, pageIndex, controller.signal);
    return () => controller.abort();
  }, [chapterIndex, chapters, pageIndex]);

  useEffect(() => {
    if (chapter && pageUrls.length > 0) onProgress(chapter, activePageIndex);
  }, [activePageIndex, chapter, onProgress, pageUrls.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [chapterIndex, mode]);

  useEffect(() => {
    if (initialScrollAppliedRef.current || chapterIndex !== initialChapter || initialPage <= 0)
      return;
    initialScrollAppliedRef.current = true;
    if (mode !== 'continuous') return;

    const frame = window.requestAnimationFrame(() => {
      const target = scrollRef.current?.querySelector<HTMLElement>(
        `[data-page-index="${initialPage}"]`,
      );
      target?.scrollIntoView({ block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [chapterIndex, initialChapter, initialPage, mode]);

  if (!chapter) return null;

  const spread = singlePage
    ? { start: activePageIndex, end: activePageIndex, right: activePageIndex, left: undefined }
    : getReaderSpread(activePageIndex, pageUrls.length);
  const pageLabel =
    pageUrls.length === 0
      ? '–'
      : spread.start === spread.end
        ? String(spread.start + 1)
        : `${spread.start + 1}–${spread.end + 1}`;
  const changeChapter = (next: number) => {
    resetZoomForLayout();
    setChapterIndex(next);
    setPageIndex(0);
  };
  const atChapterEnd =
    pageUrls.length === 0 ||
    (singlePage
      ? activePageIndex >= pageUrls.length - 1
      : getNextSpreadStart(activePageIndex, pageUrls.length) === undefined);
  return (
    <div
      className={`reader-shell ${controlsVisible ? 'controls-visible' : 'controls-hidden'} ${zoom > MIN_ZOOM ? 'is-zoomed' : ''}`}
      data-testid="reader"
      onPointerMove={(event) => {
        if (event.pointerType === 'mouse') revealControls();
      }}
    >
      <header
        ref={toolbarRef}
        className={`reader-toolbar ${controlsVisible ? 'is-visible' : 'is-hidden'}`}
        onPointerEnter={() => {
          pointerInToolbarRef.current = true;
          cancelControlsHide();
        }}
        onPointerLeave={() => {
          pointerInToolbarRef.current = false;
          scheduleControlsHide();
        }}
        onFocusCapture={revealControls}
        onBlurCapture={scheduleControlsHide}
      >
        <button className="icon-button reader-close" onClick={onClose} aria-label={t('close')}>
          <CloseIcon />
        </button>
        <div className="reader-title">
          <BookIcon />
          <div>
            <strong>{manga.name}</strong>
            <span>{t('chapter', { number: chapter.chapter })}</span>
          </div>
        </div>
        <div className="reader-controls">
          <div className="reader-chapter-selector">
            <button
              type="button"
              className="reader-chapter-button"
              data-testid="reader-next-chapter-header"
              onClick={() => changeChapter(chapterIndex + 1)}
              disabled={chapterIndex === chapters.length - 1}
              aria-label={t('nextChapter')}
              title={t('nextChapter')}
            >
              <ArrowLeftIcon />
            </button>
            <select
              value={chapterIndex}
              onChange={(event) => changeChapter(Number(event.target.value))}
              aria-label={t('chapters')}
            >
              {chapters.map((item, index) => (
                <option key={`${item.mid}-${item.chapter}`} value={index}>
                  {t('chapter', { number: item.chapter })}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="reader-chapter-button"
              data-testid="reader-previous-chapter-header"
              onClick={() => changeChapter(chapterIndex - 1)}
              disabled={chapterIndex === 0}
              aria-label={t('previousChapter')}
              title={t('previousChapter')}
            >
              <ArrowRightIcon />
            </button>
          </div>
          <div className="segmented">
            <button
              className={mode === 'continuous' ? 'active' : ''}
              data-testid="reader-mode-continuous"
              onClick={() => {
                resetZoomForLayout();
                setReaderSettings((current) => ({ ...current, mode: 'continuous' }));
              }}
            >
              {t('continuous')}
            </button>
            <button
              className={mode === 'paged' ? 'active' : ''}
              data-testid="reader-mode-paged"
              onClick={() => {
                resetZoomForLayout();
                setReaderSettings((current) => ({ ...current, mode: 'paged' }));
              }}
            >
              {t('paged')}
            </button>
          </div>
          <select
            value={fit}
            data-testid="reader-fit"
            onChange={(event) => {
              resetZoomForLayout();
              setReaderSettings((current) => ({
                ...current,
                fit: event.target.value as ReaderFitMode,
              }));
            }}
            aria-label={t('fitWidth')}
          >
            <option value="width">{t('fitWidth')}</option>
            <option value="height">{t('fitHeight')}</option>
            <option value="original">{t('original')}</option>
          </select>
          <div className="reader-zoom-controls" aria-label={t('zoom')}>
            <button
              type="button"
              onClick={() => setZoomAt(zoomRef.current - ZOOM_STEP)}
              disabled={zoom <= MIN_ZOOM}
              aria-label={t('zoomOut')}
              title={t('zoomOut')}
            >
              −
            </button>
            <button
              type="button"
              data-testid="reader-zoom-reset"
              onClick={resetZoom}
              disabled={zoom <= MIN_ZOOM}
              aria-label={t('resetZoom')}
              title={t('resetZoom')}
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => setZoomAt(zoomRef.current + ZOOM_STEP)}
              disabled={zoom >= MAX_ZOOM}
              aria-label={t('zoomIn')}
              title={t('zoomIn')}
            >
              ＋
            </button>
          </div>
        </div>
        <div className="reader-toolbar-actions">
          <span className="reader-page-status">
            {t('pageStatus', {
              current: mode === 'paged' ? pageLabel : pageIndex + 1,
              total: pageUrls.length,
            })}
          </span>
          {windowsFullscreenAvailable && (
            <button
              type="button"
              className={`icon-button reader-fullscreen ${fullscreen ? 'is-active' : ''}`}
              data-testid="reader-fullscreen"
              onClick={() => void changeFullscreen()}
              aria-label={t(fullscreen ? 'exitFullscreen' : 'enterFullscreen')}
              title={t(fullscreen ? 'exitFullscreen' : 'enterFullscreen')}
            >
              <FullscreenIcon active={fullscreen} />
            </button>
          )}
        </div>
      </header>
      <div
        ref={scrollRef}
        className={`reader-stage mode-${mode} fit-${fit} ${zoom > MIN_ZOOM ? 'is-zoomed' : ''}`}
        style={{ top: 0 }}
        onWheel={(event) => {
          if (!event.ctrlKey) return;
          event.preventDefault();
          setZoomAt(
            zoomRef.current * Math.exp(-event.deltaY * 0.0025),
            event.clientX,
            event.clientY,
          );
        }}
        onTouchStart={pullRefresh.onTouchStart}
        onTouchMove={pullRefresh.onTouchMove}
        onTouchEnd={pullRefresh.onTouchEnd}
        onTouchCancel={pullRefresh.onTouchCancel}
        onPointerDown={(event) => {
          const touchLike = event.pointerType === 'touch' || event.pointerType === 'pen';
          if (touchLike) {
            activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
            event.currentTarget.setPointerCapture?.(event.pointerId);
            if (activePointersRef.current.size >= 2) {
              clearPendingTap();
              lastTapRef.current = undefined;
              pullRefresh.cancelGesture();
              if (activePointersRef.current.size > 2) {
                suppressTapRef.current = true;
                gestureRef.current = undefined;
                return;
              }
              const [firstEntry, secondEntry] = [...activePointersRef.current.entries()];
              if (firstEntry && secondEntry) {
                const [firstId, first] = firstEntry;
                const [secondId, second] = secondEntry;
                const centerClientX = (first.x + second.x) / 2;
                const centerClientY = (first.y + second.y) / 2;
                const surfaceBounds = zoomSurfaceRef.current?.getBoundingClientRect();
                const stageBounds = event.currentTarget.getBoundingClientRect();
                const surfaceLeft =
                  surfaceBounds?.left ?? stageBounds.left - event.currentTarget.scrollLeft;
                const surfaceTop =
                  (surfaceBounds?.top ?? stageBounds.top - event.currentTarget.scrollTop) -
                  pullRefresh.pullOffset;
                pinchRef.current = {
                  pointerIds: [firstId, secondId],
                  startDistance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
                  startZoom: zoomRef.current,
                  surfaceOriginX: surfaceLeft + event.currentTarget.scrollLeft,
                  surfaceOriginY: surfaceTop + event.currentTarget.scrollTop,
                  anchorContentX: (centerClientX - surfaceLeft) / zoomRef.current,
                  anchorContentY: (centerClientY - surfaceTop) / zoomRef.current,
                };
                suppressTapRef.current = true;
                gestureRef.current = undefined;
              }
              return;
            }
          } else if (event.isPrimary === false) {
            return;
          }
          if (zoomRef.current > MIN_ZOOM + 0.01 && (touchLike || event.button === 0)) {
            event.currentTarget.setPointerCapture?.(event.pointerId);
          }
          gestureRef.current = {
            pointerId: event.pointerId,
            pointerType: event.pointerType,
            x: event.clientX,
            y: event.clientY,
            scrollLeft: event.currentTarget.scrollLeft,
            scrollTop: event.currentTarget.scrollTop,
            startedAt: performance.now(),
          };
        }}
        onPointerMove={(event) => {
          const trackedTouchPointer = activePointersRef.current.has(event.pointerId);
          if (trackedTouchPointer) {
            activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
          }
          const pinch = pinchRef.current;
          if (pinch && activePointersRef.current.size >= 2) {
            event.preventDefault();
            const [firstId, secondId] = pinch.pointerIds;
            const first = activePointersRef.current.get(firstId);
            const second = activePointersRef.current.get(secondId);
            if (!first || !second) return;
            const centerClientX = (first.x + second.x) / 2;
            const centerClientY = (first.y + second.y) / 2;
            const distance = Math.max(1, Math.hypot(second.x - first.x, second.y - first.y));
            const nextZoom = clampZoom(pinch.startZoom * (distance / pinch.startDistance));
            zoomRef.current = nextZoom;
            setZoom(nextZoom);
            queueStageScroll(
              pinch.surfaceOriginX + pinch.anchorContentX * nextZoom - centerClientX,
              pinch.surfaceOriginY + pinch.anchorContentY * nextZoom - centerClientY,
            );
            return;
          }

          const gesture = gestureRef.current;
          if (
            !gesture ||
            gesture.pointerId !== event.pointerId ||
            zoomRef.current <= MIN_ZOOM + 0.01
          ) {
            return;
          }
          event.preventDefault();
          queueStageScroll(
            gesture.scrollLeft - (event.clientX - gesture.x),
            gesture.scrollTop - (event.clientY - gesture.y),
          );
        }}
        onPointerCancel={(event) => {
          const pinch = pinchRef.current;
          activePointersRef.current.delete(event.pointerId);
          if (pinch?.pointerIds.includes(event.pointerId)) pinchRef.current = undefined;
          suppressTapRef.current = activePointersRef.current.size > 0;
          gestureRef.current = undefined;
        }}
        onPointerUp={(event) => {
          const touchLike = event.pointerType === 'touch' || event.pointerType === 'pen';
          const pinch = pinchRef.current;
          const wasPinching = Boolean(pinch) || suppressTapRef.current;
          if (touchLike) activePointersRef.current.delete(event.pointerId);
          if (wasPinching) {
            if (activePointersRef.current.size < 2 || pinch?.pointerIds.includes(event.pointerId)) {
              pinchRef.current = undefined;
            }
            if (activePointersRef.current.size === 0) suppressTapRef.current = false;
            gestureRef.current = undefined;
            return;
          }
          const gesture = gestureRef.current;
          gestureRef.current = undefined;
          if (!gesture || gesture.pointerId !== event.pointerId) return;

          const dx = event.clientX - gesture.x;
          const dy = event.clientY - gesture.y;
          const distance = Math.hypot(dx, dy);
          const elapsed = performance.now() - gesture.startedAt;

          if (
            mode === 'paged' &&
            zoomRef.current <= MIN_ZOOM + 0.01 &&
            Math.abs(dx) >= SWIPE_THRESHOLD_PX &&
            Math.abs(dx) > Math.abs(dy) * 1.2
          ) {
            changeSpread(dx < 0 ? 'next' : 'previous');
            return;
          }

          if (
            mode === 'continuous' &&
            zoomRef.current <= MIN_ZOOM + 0.01 &&
            Math.abs(dx) >= SWIPE_THRESHOLD_PX &&
            Math.abs(dx) > Math.abs(dy) * 1.2
          ) {
            const nextChapterIndex = dx > 0 ? chapterIndex + 1 : chapterIndex - 1;
            if (nextChapterIndex >= 0 && nextChapterIndex < chapters.length) {
              changeChapter(nextChapterIndex);
            }
            return;
          }

          if (distance > TAP_MOVEMENT_TOLERANCE_PX || elapsed > TAP_MAX_DURATION_MS) return;
          if (gesture.pointerType === 'touch' || gesture.pointerType === 'pen') {
            handleTouchTap(event.clientX, event.clientY);
          } else {
            runStageTap(event.clientX);
          }
        }}
      >
        <ReaderPullRefreshIndicator
          visible={pullRefresh.visible}
          ready={pullRefresh.ready}
          refreshing={pullRefresh.refreshing}
          label={t(
            pullRefresh.refreshing
              ? 'refreshingImage'
              : pullRefresh.ready
                ? 'releaseToRefresh'
                : 'pullToRefresh',
          )}
        />
        <div
          ref={zoomSurfaceRef}
          className="reader-zoom-surface"
          data-testid="reader-zoom-surface"
          style={
            {
              '--reader-zoom': zoom,
              '--reader-pull-offset': `${pullRefresh.pullOffset}px`,
            } as CSSProperties
          }
        >
          {mode === 'continuous' ? (
            <>
              {pageUrls.map((src, index) => (
                <ReaderImage
                  key={`${src}-${index}-${index === 0 ? firstPageReloadGeneration : 0}`}
                  src={src}
                  index={index}
                  onVisible={setPageIndex}
                  onBlocked={markPageBlocked}
                  loadFailedLabel={t('imageLoadFailed')}
                  retryLabel={t('reloadImage')}
                  eager={index < 10 || Math.abs(index - activePageIndex) <= 8}
                  onSettled={index === 0 ? pullRefresh.settle : undefined}
                />
              ))}
              <ChapterEndNavigation
                chapterIndex={chapterIndex}
                chapterCount={chapters.length}
                showChapterPosition
                onChange={changeChapter}
                t={t}
              />
            </>
          ) : (
            <div
              className={`reader-spread ${spread.start === 0 ? 'is-cover' : ''} ${singlePage ? 'is-single-page' : ''}`}
            >
              {pageUrls.map((url, index) => {
                const isLeft = spread.left === index;
                const isRight = spread.right === index;
                const isVisible = isLeft || isRight;
                const nearCurrentSpread =
                  index >= Math.max(0, spread.start - 2) && index <= spread.end + 4;
                return (
                  <PageImage
                    key={`${url}-${index}`}
                    className={`reader-image paged-image ${
                      isLeft
                        ? 'spread-page-left'
                        : isRight
                          ? 'spread-page-right'
                          : 'paged-image-prefetch'
                    }`}
                    url={url}
                    alt={`${index + 1}`}
                    pageIndex={index}
                    eager={nearCurrentSpread}
                    hidden={!isVisible}
                    loadFailedLabel={t('imageLoadFailed')}
                    retryLabel={t('reloadImage')}
                    onBlocked={markPageBlocked}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
      {mode === 'paged' && (
        <>
          <button
            className="page-turn page-turn-left"
            onClick={() => changeSpread('next')}
            disabled={
              chapterIndex === chapters.length - 1 &&
              getNextSpreadStart(activePageIndex, pageUrls.length) === undefined
            }
            aria-label={t('next')}
          >
            <ArrowLeftIcon />
          </button>
          <button
            className="page-turn page-turn-right"
            onClick={() => changeSpread('previous')}
            disabled={
              chapterIndex === 0 &&
              getPreviousSpreadStart(activePageIndex, pageUrls.length) === undefined
            }
            aria-label={t('previous')}
          >
            <ArrowRightIcon />
          </button>
        </>
      )}
      {mode === 'paged' && atChapterEnd && (
        <ChapterEndNavigation
          className="reader-chapter-footer-paged"
          chapterIndex={chapterIndex}
          chapterCount={chapters.length}
          onChange={changeChapter}
          t={t}
        />
      )}
      <div className={`reader-help ${controlsVisible ? 'is-visible' : 'is-hidden'}`}>
        {t('readerHelp')}
      </div>
    </div>
  );
}

function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

function isCompactPortrait() {
  return window.matchMedia?.(SINGLE_PAGE_QUERY).matches ?? false;
}

function isWindowsTauriApp() {
  return /Windows/i.test(window.navigator.userAgent) && Reflect.has(window, '__TAURI_INTERNALS__');
}

function ReaderImage({
  src,
  index,
  onVisible,
  onBlocked,
  loadFailedLabel,
  retryLabel,
  eager,
  onSettled,
}: {
  src: string;
  index: number;
  onVisible: (index: number) => void;
  onBlocked: (url: string) => void;
  loadFailedLabel: string;
  retryLabel: string;
  eager: boolean;
  onSettled?: () => void;
}) {
  return (
    <PageImage
      className="reader-image"
      url={src}
      alt={`${index + 1}`}
      pageIndex={index}
      eager={eager}
      loadFailedLabel={loadFailedLabel}
      retryLabel={retryLabel}
      onSettled={onSettled}
      onVisible={() => onVisible(index)}
      onBlocked={onBlocked}
    />
  );
}

function ChapterEndNavigation({
  className = '',
  chapterIndex,
  chapterCount,
  showChapterPosition = false,
  onChange,
  t,
}: {
  className?: string;
  chapterIndex: number;
  chapterCount: number;
  showChapterPosition?: boolean;
  onChange: (chapterIndex: number) => void;
  t: Props['t'];
}) {
  const currentChapterPosition = chapterIndex + 1;
  const chapterPercentage = Math.round((currentChapterPosition / chapterCount) * 100);
  return (
    <nav className={`reader-chapter-footer ${className}`} aria-label={t('chapters')}>
      <button
        type="button"
        className="reader-chapter-button"
        data-testid="reader-next-chapter-footer"
        onClick={() => onChange(chapterIndex + 1)}
        disabled={chapterIndex === chapterCount - 1}
      >
        {t('nextChapter')}
      </button>
      <div className="reader-chapter-footer-copy">
        <p>{t('chapterComplete')}</p>
        {showChapterPosition && (
          <span data-testid="reader-chapter-position">
            {t('chapterPosition', {
              current: currentChapterPosition,
              total: chapterCount,
              percentage: chapterPercentage,
            })}
          </span>
        )}
      </div>
      <button
        type="button"
        className="reader-chapter-button"
        data-testid="reader-previous-chapter-footer"
        onClick={() => onChange(chapterIndex - 1)}
        disabled={chapterIndex === 0}
      >
        {t('previousChapter')}
      </button>
    </nav>
  );
}
