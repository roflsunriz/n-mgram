import type { Manga } from '../api/client';
import type { MessageKey } from '../i18n';
import { HeartIcon } from './icons';

interface Props {
  manga: Manga;
  favorite: boolean;
  onOpen: (manga: Manga) => void;
  onFavorite: (id: number) => void;
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
}

export function MangaCard({ manga, favorite, onOpen, onFavorite, t }: Props) {
  return (
    <article className="manga-card" data-testid={`manga-${manga.id}`}>
      <button className="cover-button" onClick={() => onOpen(manga)} aria-label={manga.name}>
        <img src={manga.cover} alt="" loading="lazy" decoding="async" />
        <span className="chapter-pill">CH. {manga.lastChapter}</span>
      </button>
      <div className="card-copy">
        <button className="title-button" onClick={() => onOpen(manga)}>
          {manga.name}
        </button>
        <p>{manga.authors || manga.artists || '—'}</p>
      </div>
      <button
        className={`icon-button favorite-button ${favorite ? 'is-active' : ''}`}
        onClick={() => onFavorite(manga.id)}
        aria-label={favorite ? t('unfavorite') : t('favorite')}
      >
        <HeartIcon filled={favorite} />
      </button>
    </article>
  );
}
