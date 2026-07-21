import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  getChapters,
  getCollection,
  getManga,
  searchManga,
  type Chapter,
  type CollectionSort,
  type Manga,
} from './api/client';
import { AdvancedSearch, type MetadataSuggestions } from './components/advanced-search';
import { AppUpdaterPanel } from './components/app-updater-panel';
import { DetailView } from './components/detail-view';
import { BookIcon, SearchIcon } from './components/icons';
import { LibraryNavigation, type LibraryPage } from './components/library-navigation';
import { MangaCard } from './components/manga-card';
import { ChapterUpdatesPanel, ReadingHistoryPanel } from './components/reading-dashboard';
import { Reader } from './components/reader';
import { createTranslator, detectLocale } from './i18n';
import {
  createDefaultMangaFilters,
  createMangaSearchRequest,
  filterAndSortManga,
  getDirectMangaId,
  type MangaFilters,
} from './search/manga-search';
import { checkHistoryUpdates } from './services/history-update-checker';
import {
  clearHistory,
  getHistory,
  getProgress,
  hasCompleteHistoryMetadata,
  hasNewChapter,
  loadLibrary,
  removeHistory,
  saveProgress,
  toggleFavorite,
  updateHistoryCatalog,
  type ReadingProgress,
} from './storage/library-store';

type Screen = 'library' | 'detail' | 'reader';
const COLLECTION_PAGE_SIZE = 24;
const SEARCH_PAGE_SIZE = 100;

export function App() {
  const locale = useMemo(() => detectLocale(), []);
  const t = useMemo(() => createTranslator(locale), [locale]);
  const initialLibrary = useMemo(() => loadLibrary(), []);
  const [screen, setScreen] = useState<Screen>('library');
  const [libraryPage, setLibraryPage] = useState<LibraryPage>('discover');
  const [sort, setSort] = useState<CollectionSort>('update');
  const [query, setQuery] = useState('');
  const [draftFilters, setDraftFilters] = useState(createDefaultMangaFilters);
  const [appliedFilters, setAppliedFilters] = useState(createDefaultMangaFilters);

  const [discoverPage, setDiscoverPage] = useState(1);
  const [discoverItems, setDiscoverItems] = useState<Manga[]>([]);
  const [discoverHasMore, setDiscoverHasMore] = useState(true);
  const [discoverLoading, setDiscoverLoading] = useState(true);
  const [discoverError, setDiscoverError] = useState<string>();

  const [searchPage, setSearchPage] = useState(1);
  const [searchItems, setSearchItems] = useState<Manga[]>([]);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchStarted, setSearchStarted] = useState(false);
  const [searchError, setSearchError] = useState<string>();

  const [selected, setSelected] = useState<Manga>();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [readerStart, setReaderStart] = useState({ chapter: 0, page: 0 });
  const [favorites, setFavorites] = useState(initialLibrary.favorites);
  const [history, setHistory] = useState(getHistory);
  const [lastUpdateCheckAt, setLastUpdateCheckAt] = useState(initialLibrary.lastUpdateCheckAt);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updateCheckFailures, setUpdateCheckFailures] = useState(0);
  const [restoringHistoryMetadata, setRestoringHistoryMetadata] = useState(false);
  const [historyMetadataFailures, setHistoryMetadataFailures] = useState(0);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string>();

  const visibleSearchItems = useMemo(
    () => filterAndSortManga(searchItems, appliedFilters),
    [appliedFilters, searchItems],
  );
  const allLoadedItems = useMemo(
    () => deduplicateManga([...discoverItems, ...searchItems]),
    [discoverItems, searchItems],
  );
  const metadataSuggestions = useMemo(
    () => collectMetadataSuggestions(allLoadedItems),
    [allLoadedItems],
  );
  const updateCount = useMemo(
    () => history.filter(hasCompleteHistoryMetadata).filter(hasNewChapter).length,
    [history],
  );

  const loadDiscover = useCallback(
    async (nextPage: number, append: boolean, order: CollectionSort) => {
      setDiscoverLoading(true);
      setDiscoverError(undefined);
      try {
        const result = await getCollection(nextPage, order, COLLECTION_PAGE_SIZE);
        updateHistoryCatalog(result);
        setHistory(getHistory());
        setDiscoverItems((current) =>
          append ? deduplicateManga([...current, ...result]) : result,
        );
        setDiscoverPage(nextPage);
        setDiscoverHasMore(result.length >= COLLECTION_PAGE_SIZE);
      } catch (caught: unknown) {
        setDiscoverError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        setDiscoverLoading(false);
      }
    },
    [],
  );

  const loadSearch = useCallback(
    async (nextPage: number, append: boolean, filters: MangaFilters) => {
      setSearchLoading(true);
      setSearchError(undefined);
      try {
        const directMangaId = getDirectMangaId(filters);
        const directLookup = directMangaId !== undefined;
        const result = directLookup
          ? nextPage === 1
            ? [await getManga(directMangaId)]
            : []
          : await searchManga(createMangaSearchRequest(filters, nextPage, SEARCH_PAGE_SIZE));
        updateHistoryCatalog(result);
        setHistory(getHistory());
        setSearchItems((current) => (append ? deduplicateManga([...current, ...result]) : result));
        setSearchPage(nextPage);
        setSearchHasMore(!directLookup && result.length >= SEARCH_PAGE_SIZE);
      } catch (caught: unknown) {
        setSearchError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        setSearchLoading(false);
      }
    },
    [],
  );

  const restoreHistoryMetadata = useCallback(async () => {
    const incompleteHistory = getHistory().filter((entry) => !hasCompleteHistoryMetadata(entry));
    if (incompleteHistory.length === 0) {
      setHistoryMetadataFailures(0);
      return;
    }
    setRestoringHistoryMetadata(true);
    setHistoryMetadataFailures(0);
    try {
      const result = await checkHistoryUpdates(incompleteHistory);
      if (result.manga.length > 0) updateHistoryCatalog(result.manga);
      setHistory(getHistory());
      setHistoryMetadataFailures(result.failed);
    } finally {
      setRestoringHistoryMetadata(false);
    }
  }, []);

  useEffect(() => {
    // API取得は初期表示データを外部システムから読み込むためのEffect。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDiscover(1, false, 'update');
  }, [loadDiscover]);

  useEffect(() => {
    // 旧保存形式の履歴は、実データを取得できるまで仮の作品情報を表示しない。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void restoreHistoryMetadata();
  }, [restoreHistoryMetadata]);

  const submitSearch = (filters: MangaFilters) => {
    setAppliedFilters(filters);
    setSearchStarted(true);
    setLibraryPage('search');
    void loadSearch(1, false, filters);
  };

  const runSearch = (event: FormEvent) => {
    event.preventDefault();
    const nextFilters = { ...draftFilters, keyword: query.trim() };
    setDraftFilters(nextFilters);
    submitSearch(nextFilters);
  };

  const applyAdvancedFilters = () => {
    const nextFilters = { ...draftFilters, keyword: query.trim() };
    setDraftFilters(nextFilters);
    submitSearch(nextFilters);
  };

  const resetFilters = () => {
    const defaults = createDefaultMangaFilters();
    setQuery('');
    setDraftFilters(defaults);
    setAppliedFilters(defaults);
    setSearchItems([]);
    setSearchError(undefined);
    setSearchStarted(false);
    setSearchPage(1);
    setSearchHasMore(false);
  };

  const openManga = async (manga: Manga) => {
    setSelected(manga);
    setChapters([]);
    setDetailError(undefined);
    setDetailLoading(true);
    setScreen('detail');
    try {
      const [detail, chapterList] = await Promise.all([getManga(manga.id), getChapters(manga.id)]);
      setSelected(detail);
      setChapters(chapterList);
    } catch (caught: unknown) {
      setDetailError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setDetailLoading(false);
    }
  };

  const updateFavorite = (id: number) => setFavorites(toggleFavorite(id));
  const startReading = (chapter: number, savedPage = 0) => {
    const target = chapters[chapter];
    const safePage = Math.min(
      Math.max(savedPage, 0),
      Math.max(0, (target?.content.length ?? 1) - 1),
    );
    setReaderStart({ chapter, page: safePage });
    setScreen('reader');
  };

  const recordProgress = useCallback(
    (chapter: Chapter, readerPage: number) => {
      if (!selected) return;
      const latestChapter = chapters.reduce(
        (latest, item) => Math.max(latest, item.chapter),
        chapter.chapter,
      );
      setHistory(
        saveProgress({
          mangaId: selected.id,
          title: selected.name,
          cover: selected.cover,
          chapter: chapter.chapter,
          page: readerPage,
          pageCount: chapter.content.length,
          latestChapter,
        }),
      );
    },
    [chapters, selected],
  );

  const openHistoryEntry = (entry: ReadingProgress) => {
    const knownManga = allLoadedItems.find((item) => item.id === entry.mangaId);
    const summary: Manga = knownManga ?? {
      id: entry.mangaId,
      name: entry.title,
      slug: '',
      authors: '',
      transGroup: '',
      artists: '',
      released: 0,
      otherName: '',
      genres: '',
      description: '',
      mStatus: 0,
      lastUpdate: '',
      post: '',
      cover: entry.cover,
      lastChapter: String(entry.latestChapter),
      views: 0,
      submitter: 0,
      groupUploader: 0,
      hidden: 0,
      magazines: '',
    };
    void openManga(summary);
  };

  const refreshChapterUpdates = async () => {
    const currentHistory = getHistory();
    if (currentHistory.length === 0) return;
    setCheckingUpdates(true);
    setUpdateCheckFailures(0);
    try {
      const result = await checkHistoryUpdates(currentHistory);
      setUpdateCheckFailures(result.failed);
      if (result.manga.length > 0) {
        const library = updateHistoryCatalog(result.manga, true);
        setHistory(getHistory());
        setLastUpdateCheckAt(library.lastUpdateCheckAt);
      }
    } finally {
      setCheckingUpdates(false);
    }
  };

  if (screen === 'reader' && selected) {
    return (
      <Reader
        manga={selected}
        chapters={chapters}
        initialChapter={readerStart.chapter}
        initialPage={readerStart.page}
        onClose={() => setScreen('detail')}
        onProgress={recordProgress}
        t={t}
      />
    );
  }

  if (screen === 'detail' && selected) {
    return (
      <DetailView
        manga={selected}
        chapters={chapters}
        favorite={favorites.includes(selected.id)}
        loading={detailLoading}
        error={detailError}
        progress={getProgress(selected.id)}
        onBack={() => setScreen('library')}
        onFavorite={() => updateFavorite(selected.id)}
        onRead={startReading}
        onRetry={() => void openManga(selected)}
        t={t}
      />
    );
  }

  return (
    <div className={`app-shell page-${libraryPage}`}>
      <header className="topbar">
        <button className="brand" type="button" onClick={() => setLibraryPage('discover')}>
          <span className="brand-mark">
            <BookIcon />
          </span>
          <span>n-mgram</span>
        </button>
        <form className="search-form" onSubmit={runSearch}>
          <SearchIcon />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setDraftFilters((current) => ({ ...current, keyword: event.target.value }));
            }}
            placeholder={t('search')}
            aria-label={t('search')}
          />
          <button type="submit">{t('searchAction')}</button>
        </form>
      </header>
      <LibraryNavigation
        activePage={libraryPage}
        historyCount={history.length}
        updateCount={updateCount}
        onNavigate={setLibraryPage}
        t={t}
      />
      <main id="top" className="library-view">
        {libraryPage === 'discover' && (
          <>
            <PageHeading title={t('discover')} hint={t('libraryHint')} eyebrow="YOUR READING ROOM">
              <div className="sort-tabs" role="group">
                {(['update', 'new', 'top'] as CollectionSort[]).map((value) => (
                  <button
                    key={value}
                    className={sort === value ? 'active' : ''}
                    onClick={() => {
                      setSort(value);
                      void loadDiscover(1, false, value);
                    }}
                  >
                    {t(value === 'update' ? 'updated' : value === 'new' ? 'newest' : 'popular')}
                  </button>
                ))}
              </div>
            </PageHeading>
            <MangaResults
              items={discoverItems}
              loadedCount={discoverItems.length}
              loading={discoverLoading}
              error={discoverError}
              hasMore={discoverHasMore}
              favorites={favorites}
              onOpen={(manga) => void openManga(manga)}
              onFavorite={updateFavorite}
              onRetry={() => void loadDiscover(discoverPage, false, sort)}
              onLoadMore={() => void loadDiscover(discoverPage + 1, true, sort)}
              t={t}
            />
          </>
        )}

        {libraryPage === 'search' && (
          <>
            <PageHeading
              title={t('searchHeading')}
              hint={t('searchPageHint')}
              eyebrow="FIND YOUR NEXT STORY"
            />
            <AdvancedSearch
              filters={draftFilters}
              suggestions={metadataSuggestions}
              onChange={(key, value) =>
                setDraftFilters((current) => ({ ...current, [key]: value }) as MangaFilters)
              }
              onApply={applyAdvancedFilters}
              onReset={resetFilters}
              t={t}
            />
            {!searchStarted ? (
              <div className="dashboard-empty search-ready">
                <SearchIcon />
                <p>{t('searchReady')}</p>
              </div>
            ) : (
              <MangaResults
                items={visibleSearchItems}
                loadedCount={searchItems.length}
                loading={searchLoading}
                error={searchError}
                hasMore={searchHasMore}
                favorites={favorites}
                onOpen={(manga) => void openManga(manga)}
                onFavorite={updateFavorite}
                onRetry={() => void loadSearch(searchPage, false, appliedFilters)}
                onLoadMore={() => void loadSearch(searchPage + 1, true, appliedFilters)}
                t={t}
              />
            )}
          </>
        )}

        {libraryPage === 'history' && (
          <>
            <PageHeading
              title={t('historyHeading')}
              hint={t('historyPageHint')}
              eyebrow="READING LOG"
            />
            <ReadingHistoryPanel
              history={history}
              locale={locale}
              restoringMetadata={restoringHistoryMetadata}
              metadataFailures={historyMetadataFailures}
              onOpen={openHistoryEntry}
              onDelete={(mangaId) => setHistory(removeHistory(mangaId))}
              onClear={() => setHistory(clearHistory())}
              onRetryMetadata={() => void restoreHistoryMetadata()}
              t={t}
            />
          </>
        )}

        {libraryPage === 'updates' && (
          <>
            <PageHeading
              title={t('updatesHeading')}
              hint={t('updatesPageHint')}
              eyebrow="CHAPTER UPDATES"
            />
            <div className="updates-stack">
              <AppUpdaterPanel t={t} />
              <ChapterUpdatesPanel
                history={history}
                locale={locale}
                lastUpdateCheckAt={lastUpdateCheckAt}
                checkingUpdates={checkingUpdates}
                updateCheckFailures={updateCheckFailures}
                onOpen={openHistoryEntry}
                onCheckUpdates={() => void refreshChapterUpdates()}
                t={t}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

interface PageHeadingProps {
  title: string;
  hint: string;
  eyebrow: string;
  children?: React.ReactNode;
}

function PageHeading({ title, hint, eyebrow, children }: PageHeadingProps) {
  return (
    <section className="library-intro">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{hint}</p>
      </div>
      {children}
    </section>
  );
}

interface MangaResultsProps {
  items: Manga[];
  loadedCount: number;
  loading: boolean;
  error?: string;
  hasMore: boolean;
  favorites: number[];
  onOpen: (manga: Manga) => void;
  onFavorite: (id: number) => void;
  onRetry: () => void;
  onLoadMore: () => void;
  t: ReturnType<typeof createTranslator>;
}

function MangaResults({
  items,
  loadedCount,
  loading,
  error,
  hasMore,
  favorites,
  onOpen,
  onFavorite,
  onRetry,
  onLoadMore,
  t,
}: MangaResultsProps) {
  return (
    <>
      {error && (
        <div className="status-panel error-panel">
          <p>{error}</p>
          <button onClick={onRetry}>{t('retry')}</button>
        </div>
      )}
      {!loading && !error && items.length === 0 && (
        <div className="status-panel">{t('noResults')}</div>
      )}
      {!error && loadedCount > 0 && (
        <p className="result-summary" aria-live="polite">
          {t('resultSummary', { shown: items.length, loaded: loadedCount })}
        </p>
      )}
      <section className="manga-grid" aria-live="polite">
        {items.map((manga) => (
          <MangaCard
            key={manga.id}
            manga={manga}
            favorite={favorites.includes(manga.id)}
            onOpen={onOpen}
            onFavorite={onFavorite}
            t={t}
          />
        ))}
      </section>
      {loading && (
        <div className="loading-row">
          <span className="spinner" />
          {t('loading')}
        </div>
      )}
      {!loading && !error && loadedCount > 0 && hasMore && (
        <button className="load-more" onClick={onLoadMore}>
          {t('loadMore')}
        </button>
      )}
    </>
  );
}

function deduplicateManga(items: readonly Manga[]): Manga[] {
  return [...new Map(items.map((manga) => [manga.id, manga])).values()];
}

function collectMetadataSuggestions(items: readonly Manga[]): MetadataSuggestions {
  const collect = (values: string[], split = false) =>
    [
      ...new Set(
        values
          .flatMap((value) => (split ? value.split(',') : [value]))
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ]
      .sort((left, right) => left.localeCompare(right, 'ja', { sensitivity: 'base' }))
      .slice(0, 300);
  return {
    authors: collect(items.map((manga) => manga.authors)),
    artists: collect(items.map((manga) => manga.artists)),
    genres: collect(
      items.map((manga) => manga.genres),
      true,
    ),
    magazines: collect(items.map((manga) => manga.magazines)),
    translationGroups: collect(items.map((manga) => manga.transGroup)),
  };
}
