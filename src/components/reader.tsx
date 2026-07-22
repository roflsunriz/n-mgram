import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { Chapter, Manga } from '../api/client';
import type { MessageKey } from '../i18n';
import { prefetchReaderPages } from '../services/reader-prefetch';
import {
  loadReaderSettings,
  saveReaderSettings,
  type ReaderFitMode,
} from '../storage/reader-settings-store';
import { ArrowLeftIcon, ArrowRightIcon, BookIcon, CloseIcon, FullscreenIcon } from './icons';
import { PageImage } from './page-image';
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
const SINGLE_PAGE_QUERY = '(max-width: 620px) and (orientation: portrait)';

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
  const windowsFullscreenAvailable = isWindowsTauriApp();
  const chapter = chapters[chapterIndex];
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialScrollAppliedRef = useRef(false);
  const toolbarRef = useRef<HTMLElement>(null);
  const controlsTimerRef = useRef<number | undefined>(undefined);
  const pointerInToolbarRef = useRef(false);
  const fullscreenRef = useRef(false);
  const gestureRef = useRef<
    | {
        pointerId: number;
        x: number;
        y: number;
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
        setChapterIndex((value) => value + 1);
        setPageIndex(0);
      } else if (direction === 'previous' && chapterIndex > 0) {
        const previous = chapters[chapterIndex - 1];
        const previousPageCount =
          previous?.content.filter((url) => !blockedPageUrls.has(url)).length ?? 0;
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
      singlePage,
    ],
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
      if (mode === 'paged' && event.key === 'ArrowLeft') changeSpread('next');
      if (mode === 'paged' && event.key === 'ArrowRight') changeSpread('previous');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [changeFullscreen, changeSpread, mode, onClose, windowsFullscreenAvailable]);

  useEffect(() => {
    scheduleControlsHide();
    return cancelControlsHide;
  }, [cancelControlsHide, scheduleControlsHide]);

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
      className={`reader-shell ${controlsVisible ? 'controls-visible' : 'controls-hidden'}`}
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
              onClick={() => setReaderSettings((current) => ({ ...current, mode: 'continuous' }))}
            >
              {t('continuous')}
            </button>
            <button
              className={mode === 'paged' ? 'active' : ''}
              data-testid="reader-mode-paged"
              onClick={() => setReaderSettings((current) => ({ ...current, mode: 'paged' }))}
            >
              {t('paged')}
            </button>
          </div>
          <select
            value={fit}
            data-testid="reader-fit"
            onChange={(event) =>
              setReaderSettings((current) => ({
                ...current,
                fit: event.target.value as ReaderFitMode,
              }))
            }
            aria-label={t('fitWidth')}
          >
            <option value="width">{t('fitWidth')}</option>
            <option value="height">{t('fitHeight')}</option>
            <option value="original">{t('original')}</option>
          </select>
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
        className={`reader-stage mode-${mode} fit-${fit}`}
        onPointerDown={(event) => {
          if (event.isPrimary === false) return;
          gestureRef.current = {
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            startedAt: performance.now(),
          };
        }}
        onPointerCancel={() => {
          gestureRef.current = undefined;
        }}
        onPointerUp={(event) => {
          const gesture = gestureRef.current;
          gestureRef.current = undefined;
          if (!gesture || gesture.pointerId !== event.pointerId) return;

          const dx = event.clientX - gesture.x;
          const dy = event.clientY - gesture.y;
          const distance = Math.hypot(dx, dy);
          const elapsed = performance.now() - gesture.startedAt;

          if (
            mode === 'paged' &&
            Math.abs(dx) >= SWIPE_THRESHOLD_PX &&
            Math.abs(dx) > Math.abs(dy) * 1.2
          ) {
            changeSpread(dx < 0 ? 'next' : 'previous');
            return;
          }

          if (distance > TAP_MOVEMENT_TOLERANCE_PX || elapsed > TAP_MAX_DURATION_MS) return;
          if (mode !== 'paged') {
            toggleControls();
            return;
          }

          const bounds = event.currentTarget.getBoundingClientRect();
          const relativeX = bounds.width > 0 ? (event.clientX - bounds.left) / bounds.width : 0.5;
          if (relativeX < 0.32) changeSpread('next');
          else if (relativeX > 0.68) changeSpread('previous');
          else toggleControls();
        }}
      >
        {mode === 'continuous' ? (
          <>
            {pageUrls.map((src, index) => (
              <ReaderImage
                key={`${src}-${index}`}
                src={src}
                index={index}
                onVisible={setPageIndex}
                onBlocked={markPageBlocked}
                loadFailedLabel={t('imageLoadFailed')}
                retryLabel={t('reloadImage')}
                eager={index < 10 || Math.abs(index - activePageIndex) <= 8}
              />
            ))}
            <ChapterEndNavigation
              chapterIndex={chapterIndex}
              chapterCount={chapters.length}
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
}: {
  src: string;
  index: number;
  onVisible: (index: number) => void;
  onBlocked: (url: string) => void;
  loadFailedLabel: string;
  retryLabel: string;
  eager: boolean;
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
      onVisible={() => onVisible(index)}
      onBlocked={onBlocked}
    />
  );
}

function ChapterEndNavigation({
  className = '',
  chapterIndex,
  chapterCount,
  onChange,
  t,
}: {
  className?: string;
  chapterIndex: number;
  chapterCount: number;
  onChange: (chapterIndex: number) => void;
  t: Props['t'];
}) {
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
      <p>{t('chapterComplete')}</p>
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
