import type { MessageKey } from '../i18n';
import { BellIcon, BookIcon, HistoryIcon, SearchIcon } from './icons';

export type LibraryPage = 'discover' | 'search' | 'history' | 'updates';

interface Props {
  activePage: LibraryPage;
  historyCount: number;
  updateCount: number;
  onNavigate: (page: LibraryPage) => void;
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
}

const pages = [
  { id: 'discover', label: 'discoverPage', icon: BookIcon },
  { id: 'search', label: 'searchPage', icon: SearchIcon },
  { id: 'history', label: 'historyPage', icon: HistoryIcon },
  { id: 'updates', label: 'updatesPage', icon: BellIcon },
] as const;

export function LibraryNavigation({ activePage, historyCount, updateCount, onNavigate, t }: Props) {
  return (
    <nav className="main-tabs" aria-label={t('libraryNavigation')}>
      <div className="main-tabs-inner">
        {pages.map(({ id, label, icon: Icon }) => {
          const count = id === 'history' ? historyCount : id === 'updates' ? updateCount : 0;
          return (
            <button
              key={id}
              type="button"
              className={activePage === id ? 'active' : ''}
              aria-current={activePage === id ? 'page' : undefined}
              data-testid={`library-tab-${id}`}
              onClick={() => onNavigate(id)}
            >
              <Icon />
              <span>{t(label)}</span>
              {count > 0 && <span className="tab-badge">{count}</span>}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
