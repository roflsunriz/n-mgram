import type { MessageKey } from '../i18n';

type Translate = (key: MessageKey, values?: Record<string, string | number>) => string;

export function EndOfContentsPage({
  chapterIndex,
  chapterCount,
  t,
}: {
  chapterIndex: number;
  chapterCount: number;
  t: Translate;
}) {
  const currentChapterPosition = chapterIndex + 1;
  const chapterPercentage = Math.round((currentChapterPosition / chapterCount) * 100);
  return (
    <section
      className="reader-end-page spread-page-left"
      data-testid="reader-end-page"
      aria-label={t('endOfContents')}
    >
      <strong>{t('endOfContents')}</strong>
      <span>
        {t('chapterCountProgress', {
          current: currentChapterPosition,
          total: chapterCount,
        })}
      </span>
      <span>{t('readPercentage', { percentage: chapterPercentage })}</span>
    </section>
  );
}

export function ChapterEndNavigation({
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
  t: Translate;
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
