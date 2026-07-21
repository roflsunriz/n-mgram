import type { Locale, MessageKey } from '../i18n';
import {
  getProgressPercentage,
  hasCompleteHistoryMetadata,
  hasNewChapter,
  type ReadingProgress,
} from '../storage/library-store';
import { BellIcon, BookIcon, TrashIcon } from './icons';

interface SharedProps {
  history: ReadingProgress[];
  locale: Locale;
  onOpen: (entry: ReadingProgress) => void;
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
}

interface HistoryProps extends SharedProps {
  restoringMetadata: boolean;
  metadataFailures: number;
  onDelete: (mangaId: number) => void;
  onClear: () => void;
  onRetryMetadata: () => void;
}

interface UpdatesProps extends SharedProps {
  lastUpdateCheckAt?: string;
  checkingUpdates: boolean;
  updateCheckFailures: number;
  onCheckUpdates: () => void;
}

function formatHistoryDate(value: string, locale: Locale, t: SharedProps['t']): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? t('unknownDate')
    : new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function ReadingHistoryPanel({
  history,
  locale,
  restoringMetadata,
  metadataFailures,
  onOpen,
  onDelete,
  onClear,
  onRetryMetadata,
  t,
}: HistoryProps) {
  const completeHistory = history.filter(hasCompleteHistoryMetadata);
  const incompleteCount = history.length - completeHistory.length;

  return (
    <section className="dashboard-panel standalone-panel history-panel">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">READING LOG</p>
          <h2>{t('readingHistory')}</h2>
        </div>
        <div className="history-heading-actions">
          {history.length > 0 && (
            <button
              type="button"
              className="clear-history-button"
              data-testid="clear-history"
              onClick={() => {
                if (window.confirm(t('clearHistoryConfirm'))) onClear();
              }}
            >
              <TrashIcon />
              {t('clearHistory')}
            </button>
          )}
          <span className="count-badge">{history.length}</span>
        </div>
      </div>
      {restoringMetadata && incompleteCount > 0 && (
        <div className="history-restore-status" role="status">
          <span className="spinner" />
          <span>{t('restoringHistory', { count: incompleteCount })}</span>
        </div>
      )}
      {!restoringMetadata && metadataFailures > 0 && incompleteCount > 0 && (
        <div className="history-restore-error" role="alert">
          <p>{t('historyRestoreFailed', { count: metadataFailures })}</p>
          <button type="button" onClick={onRetryMetadata}>
            {t('retryRestore')}
          </button>
        </div>
      )}
      {history.length === 0 ? (
        <div className="dashboard-empty">
          <BookIcon />
          <p>{t('noHistory')}</p>
        </div>
      ) : completeHistory.length > 0 ? (
        <div className="history-list">
          {completeHistory.map((entry) => {
            const percentage = getProgressPercentage(entry);
            return (
              <article className="history-entry" key={entry.mangaId}>
                <button
                  className="history-open"
                  data-testid={`history-open-${entry.mangaId}`}
                  onClick={() => onOpen(entry)}
                >
                  <img src={entry.cover} alt="" loading="lazy" decoding="async" />
                  <span className="history-copy">
                    <strong>{entry.title}</strong>
                    <span className="history-meta">
                      {t('chapter', { number: entry.chapter })} ·{' '}
                      {t('readPercentage', { percentage })}
                    </span>
                    <span
                      className="progress-track"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={percentage}
                    >
                      <span style={{ width: `${percentage}%` }} />
                    </span>
                    <time dateTime={entry.updatedAt}>
                      {t('lastReadAt', {
                        date: formatHistoryDate(entry.updatedAt, locale, t),
                      })}
                    </time>
                  </span>
                </button>
                <button
                  className="history-delete"
                  data-testid={`history-delete-${entry.mangaId}`}
                  onClick={() => {
                    if (window.confirm(t('deleteHistoryConfirm'))) onDelete(entry.mangaId);
                  }}
                  aria-label={t('deleteHistory')}
                >
                  <TrashIcon />
                </button>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

export function ChapterUpdatesPanel({
  history,
  locale,
  lastUpdateCheckAt,
  checkingUpdates,
  updateCheckFailures,
  onOpen,
  onCheckUpdates,
  t,
}: UpdatesProps) {
  const updates = history.filter(hasCompleteHistoryMetadata).filter(hasNewChapter);

  return (
    <section
      className="dashboard-panel standalone-panel notification-panel"
      data-testid="chapter-updates-panel"
    >
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">CHAPTER UPDATES</p>
          <h2>{t('notificationCenter')}</h2>
        </div>
        {updates.length > 0 && <span className="notification-badge">{updates.length}</span>}
      </div>
      <button
        className="check-updates-button"
        data-testid="check-history-updates"
        disabled={checkingUpdates || history.length === 0}
        onClick={onCheckUpdates}
      >
        {checkingUpdates ? t('checkingUpdates') : t('checkUpdates')}
      </button>
      <p className="last-checked">
        {lastUpdateCheckAt
          ? t('lastCheckedAt', {
              date: formatHistoryDate(lastUpdateCheckAt, locale, t),
            })
          : t('notCheckedYet')}
      </p>
      {updateCheckFailures > 0 && (
        <p className="update-check-error">
          {t('updateCheckPartialFailure', { count: updateCheckFailures })}
        </p>
      )}
      {updates.length === 0 ? (
        <div className="dashboard-empty notification-empty">
          <BellIcon />
          <p>{history.length === 0 ? t('notificationsNeedHistory') : t('noChapterUpdates')}</p>
        </div>
      ) : (
        <div className="notification-list" aria-live="polite">
          {updates.map((entry) => (
            <button
              className="notification-entry"
              data-testid={`notification-open-${entry.mangaId}`}
              key={entry.mangaId}
              onClick={() => onOpen(entry)}
            >
              <span className="notification-dot" />
              <span>
                <strong>{entry.title}</strong>
                <small>
                  {t('newChapterAvailable', {
                    chapter: entry.latestChapter,
                    readChapter: entry.chapter,
                  })}
                </small>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
