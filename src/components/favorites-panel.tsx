import type { Manga } from '../api/client';
import type { MessageKey } from '../i18n';
import { HeartIcon } from './icons';
import { MangaCard } from './manga-card';

interface Props {
  items: Manga[];
  savedTitles: string[];
  favoriteCount: number;
  loading: boolean;
  failed: number;
  onOpen: (manga: Manga) => void;
  onFavorite: (manga: Manga) => void;
  onRetry: () => void;
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
}

export function FavoritesPanel({
  items,
  savedTitles,
  favoriteCount,
  loading,
  failed,
  onOpen,
  onFavorite,
  onRetry,
  t,
}: Props) {
  return (
    <section className="dashboard-panel standalone-panel favorites-panel">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">FAVORITES</p>
          <h2>{t('favoriteTitles')}</h2>
        </div>
        <span className="count-badge">{favoriteCount}</span>
      </div>
      {failed > 0 && (
        <div className="history-restore-error" role="alert">
          <p>{t('favoritesLoadFailed', { count: failed })}</p>
          <button type="button" onClick={onRetry}>
            {t('retry')}
          </button>
        </div>
      )}
      {loading && (
        <div className="loading-row" role="status">
          <span className="spinner" />
          {t('loading')}
        </div>
      )}
      {savedTitles.length > 0 && (
        <ul className="favorite-saved-titles" aria-label={t('favoriteTitles')}>
          {savedTitles.map((title, index) => (
            <li key={`${title}-${index}`}>{title}</li>
          ))}
        </ul>
      )}
      {!loading && favoriteCount === 0 ? (
        <div className="dashboard-empty">
          <HeartIcon />
          <p>{t('noFavorites')}</p>
        </div>
      ) : (
        items.length > 0 && (
          <div className="manga-grid">
            {items.map((manga) => (
              <MangaCard
                key={manga.id}
                manga={manga}
                favorite
                onOpen={onOpen}
                onFavorite={onFavorite}
                t={t}
              />
            ))}
          </div>
        )
      )}
    </section>
  );
}
