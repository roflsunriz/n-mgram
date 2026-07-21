import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Chapter, Manga } from '../api/client';
import type { MessageKey } from '../i18n';
import {
  loadReaderSettings,
  saveReaderSettings,
  type ReaderFitMode,
} from '../storage/reader-settings-store';
import { ArrowLeftIcon, ArrowRightIcon, BookIcon, CloseIcon } from './icons';
import { PageImage } from './page-image';
import {
  getLastSpreadStart,
  getNextSpreadStart,
  getPreviousSpreadStart,
  getReaderSpread,
} from './reader-spread';

const CONTROLS_HIDE_DELAY_MS = 2_500;

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
  const [blockedPageUrls, setBlockedPageUrls] = useState<ReadonlySet<string>>(() => new Set());
  const [controlsVisible, setControlsVisible] = useState(true);
  const chapter = chapters[chapterIndex];
  const scrollRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLElement>(null);
  const controlsTimerRef = useRef<number | undefined>(undefined);
  const pointerInToolbarRef = useRef(false);
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

  const changeSpread = useCallback(
    (direction: 'next' | 'previous') => {
      if (!chapter) return;
      const nextPage =
        direction === 'next'
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
        setPageIndex(getLastSpreadStart(previousPageCount));
      }
    },
    [activePageIndex, blockedPageUrls, chapter, chapterIndex, chapters, pageUrls.length],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      revealControls();
      if (event.key === 'Escape') onClose();
      if (mode === 'paged' && event.key === 'ArrowLeft') changeSpread('next');
      if (mode === 'paged' && event.key === 'ArrowRight') changeSpread('previous');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [changeSpread, mode, onClose, revealControls]);

  useEffect(() => {
    scheduleControlsHide();
    return cancelControlsHide;
  }, [cancelControlsHide, scheduleControlsHide]);

  useEffect(() => {
    saveReaderSettings(readerSettings);
  }, [readerSettings]);

  useEffect(() => {
    if (chapter && pageUrls.length > 0) onProgress(chapter, activePageIndex);
  }, [activePageIndex, chapter, onProgress, pageUrls.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [chapterIndex, mode]);

  if (!chapter) return null;

  const spread = getReaderSpread(activePageIndex, pageUrls.length);
  const pageLabel =
    pageUrls.length === 0
      ? '–'
      : spread.start === spread.end
        ? String(spread.start + 1)
        : `${spread.start + 1}–${spread.end + 1}`;
  const rightPageUrl = pageUrls[spread.right];
  const leftPageUrl = spread.left === undefined ? undefined : pageUrls[spread.left];
  const changeChapter = (next: number) => {
    setChapterIndex(next);
    setPageIndex(0);
  };
  return (
    <div
      className={`reader-shell ${controlsVisible ? 'controls-visible' : 'controls-hidden'}`}
      data-testid="reader"
      onPointerMove={revealControls}
      onPointerDown={revealControls}
      onFocusCapture={revealControls}
      onBlurCapture={scheduleControlsHide}
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
        <span className="reader-page-status">
          {t('pageStatus', {
            current: mode === 'paged' ? pageLabel : pageIndex + 1,
            total: pageUrls.length,
          })}
        </span>
      </header>
      <div ref={scrollRef} className={`reader-stage mode-${mode} fit-${fit}`}>
        {mode === 'continuous' ? (
          pageUrls.map((src, index) => (
            <ReaderImage
              key={src}
              src={src}
              index={index}
              onVisible={setPageIndex}
              onBlocked={markPageBlocked}
            />
          ))
        ) : (
          <div className={`reader-spread ${spread.start === 0 ? 'is-cover' : ''}`}>
            {leftPageUrl && (
              <PageImage
                key={leftPageUrl}
                className="reader-image paged-image spread-page-left"
                url={leftPageUrl}
                alt={`${(spread.left ?? spread.start) + 1}`}
                eager
                onBlocked={markPageBlocked}
              />
            )}
            {rightPageUrl && (
              <PageImage
                key={rightPageUrl}
                className="reader-image paged-image spread-page-right"
                url={rightPageUrl}
                alt={`${spread.right + 1}`}
                eager
                onBlocked={markPageBlocked}
              />
            )}
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
      <div className={`reader-help ${controlsVisible ? 'is-visible' : 'is-hidden'}`}>
        {t('readerHelp')}
      </div>
    </div>
  );
}

function ReaderImage({
  src,
  index,
  onVisible,
  onBlocked,
}: {
  src: string;
  index: number;
  onVisible: (index: number) => void;
  onBlocked: (url: string) => void;
}) {
  return (
    <PageImage
      className="reader-image"
      url={src}
      alt={`${index + 1}`}
      eager={index < 2}
      onVisible={() => onVisible(index)}
      onBlocked={onBlocked}
    />
  );
}
