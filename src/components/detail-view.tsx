import { useState } from 'react';
import type { Chapter, Manga } from '../api/client';
import type { MessageKey } from '../i18n';
import type { ReadingProgress } from '../storage/library-store';
import { ArrowLeftIcon, HeartIcon } from './icons';

interface Props {
  manga: Manga;
  chapters: Chapter[];
  favorite: boolean;
  loading: boolean;
  error?: string;
  progress?: ReadingProgress;
  onBack: () => void;
  onFavorite: () => void;
  onRead: (chapterIndex: number, page?: number) => void;
  onRetry: () => void;
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
}

export function DetailView({
  manga,
  chapters,
  favorite,
  loading,
  error,
  progress,
  onBack,
  onFavorite,
  onRead,
  onRetry,
  t,
}: Props) {
  const [newestFirst, setNewestFirst] = useState(true);
  const resumeIndex = progress
    ? Math.max(
        0,
        chapters.findIndex((item) => item.chapter === progress.chapter),
      )
    : 0;
  const genres = manga.genres
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
  return (
    <main className="detail-view">
      <button className="back-button" onClick={onBack}>
        <ArrowLeftIcon />
        {t('back')}
      </button>
      <section className="detail-hero">
        <div className="detail-cover-wrap">
          <img className="detail-cover" src={manga.cover} alt="" />
        </div>
        <div className="detail-copy">
          <p className="eyebrow">n-mgram collection</p>
          <h1>{manga.name}</h1>
          <p className="byline">{manga.authors || manga.artists}</p>
          <div className="tags">
            {genres.map((genre) => (
              <span key={genre}>{genre}</span>
            ))}
          </div>
          <p className="description">{manga.description}</p>
          <div className="detail-actions">
            <button
              className="primary-button"
              disabled={loading || chapters.length === 0}
              onClick={() => onRead(resumeIndex, progress?.page)}
            >
              {progress ? t('resumeReading') : t('startReading')}
            </button>
            <button
              className={`secondary-button ${favorite ? 'is-active' : ''}`}
              onClick={onFavorite}
            >
              <HeartIcon filled={favorite} />
              {favorite ? t('unfavorite') : t('favorite')}
            </button>
          </div>
        </div>
      </section>
      <section className="chapter-section">
        <div className="section-heading">
          <h2>{t('chapters')}</h2>
          <span>{chapters.length}</span>
          {chapters.length > 1 && (
            <button
              type="button"
              className="chapter-order-button"
              data-testid="chapter-order-toggle"
              onClick={() => setNewestFirst((current) => !current)}
            >
              {newestFirst ? t('showOldestFirst') : t('showNewestFirst')}
            </button>
          )}
        </div>
        {loading && <div className="status-panel">{t('loading')}</div>}
        {error && (
          <div className="status-panel error-panel">
            <p>{error}</p>
            <button onClick={onRetry}>{t('retry')}</button>
          </div>
        )}
        {!loading && !error && chapters.length === 0 && (
          <div className="status-panel">{t('noChapters')}</div>
        )}
        <div className="chapter-list">
          {(newestFirst ? [...chapters].reverse() : chapters).map((chapter) => {
            const chapterIndex = chapters.indexOf(chapter);
            const completed =
              progress &&
              (chapter.chapter < progress.chapter ||
                (chapter.chapter === progress.chapter &&
                  progress.page >= chapter.content.length - 1));
            return (
              <button
                key={`${chapter.mid}-${chapter.chapter}`}
                className="chapter-row"
                onClick={() => onRead(chapterIndex)}
              >
                <span className="chapter-number">{t('chapter', { number: chapter.chapter })}</span>
                <span>{t('pages', { count: chapter.content.length })}</span>
                {completed && <span className="read-mark">READ</span>}
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}
