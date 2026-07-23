import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  getChapters,
  getManga,
  searchManga,
  type Chapter,
  type CollectionSort,
  type Manga,
} from './api/client';
import { AdvancedSearch, type MetadataSuggestions } from './components/advanced-search';
import { AppUpdaterPanel } from './components/app-updater-panel';
import { DetailView } from './components/detail-view';
import { FavoritesPanel } from './components/favorites-panel';
import { BookIcon, SearchIcon } from './components/icons';
import { LibraryNavigation, type LibraryPage } from './components/library-navigation';
import { MangaCard } from './components/manga-card';
import { ChapterUpdatesPanel, ReadingHistoryPanel } from './components/reading-dashboard';
import { Reader } from './components/reader';
import { createTranslator, detectLocale } from './i18n';
import { COLLECTION_SORTS, useDiscoverCollections } from './hooks/use-discover-collections';
import {
  createDefaultMangaFilters,
  createMangaSearchRequest,
  filterAndSortManga,
  getDirectMangaId,
  hasSearchCriteria,
  type MangaFilters,
  type MangaSortKey,
  type SortDirection,
} from './search/manga-search';
import { checkHistoryUpdates } from './services/history-update-checker';
import { loadFavoriteCatalog } from './services/favorite-catalog-loader';
import { prefetchChapterEdges } from './services/chapter-edge-prefetch';
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
const NAVIGATION_STATE_KEY = 'nMgramScreen';
const NAVIGATION_PAGE_STATE_KEY = 'nMgramLibraryPage';
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
  const [history, setHistory] = useState(getHistory);

  const handleDiscoverLoaded = useCallback((items: Manga[]) => {
    updateHistoryCatalog(items);
    setHistory(getHistory());
  }, []);
  const {
    collections: discoverCollections,
    load: loadDiscover,
    prefetch: prefetchDiscover,
    revealPrefetched: revealPrefetchedDiscover,
  } = useDiscoverCollections(handleDiscoverLoaded);
  const {
    items: discoverItems,
    page: discoverPage,
    hasMore: discoverHasMore,
    loading: discoverLoading,
    prefetchedPage: discoverPrefetchedPage,
    prefetchError: discoverPrefetchError,
    error: discoverError,
  } = discoverCollections[sort];

  const [searchPage, setSearchPage] = useState(1);
  const [searchItems, setSearchItems] = useState<Manga[]>([]);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchStarted, setSearchStarted] = useState(false);
  const [searchError, setSearchError] = useState<string>();

  const [selected, setSelected] = useState<Manga>();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [readerStart, setReaderStart] = useState({ chapter: 0, page: 0 });
  const [favoriteEntries, setFavoriteEntries] = useState(initialLibrary.favorites);
  const [favoriteCatalog, setFavoriteCatalog] = useState<Manga[]>([]);
  const [favoriteCatalogLoading, setFavoriteCatalogLoading] = useState(false);
  const [favoriteCatalogFailures, setFavoriteCatalogFailures] = useState(0);
  const favoriteAttemptedIdsRef = useRef(new Set<number>());
  const [lastUpdateCheckAt, setLastUpdateCheckAt] = useState(initialLibrary.lastUpdateCheckAt);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updateCheckFailures, setUpdateCheckFailures] = useState(0);
  const [restoringHistoryMetadata, setRestoringHistoryMetadata] = useState(false);
  const [historyMetadataFailures, setHistoryMetadataFailures] = useState(0);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string>();

  const navigateForward = useCallback((nextScreen: Screen) => {
    window.history.pushState({ [NAVIGATION_STATE_KEY]: nextScreen }, '');
    setScreen(nextScreen);
  }, []);

  const navigateBack = useCallback((fallback: Screen) => {
    const currentScreen = getNavigationScreen(window.history.state);
    if (currentScreen && currentScreen !== 'library') window.history.back();
    else setScreen(fallback);
  }, []);

  const navigateLibraryPage = useCallback(
    (nextPage: LibraryPage) => {
      if (nextPage === libraryPage) return;
      const currentPage = getNavigationLibraryPage(window.history.state);
      if (nextPage === 'discover') {
        if (currentPage && currentPage !== 'discover') window.history.back();
        else {
          window.history.replaceState(
            {
              [NAVIGATION_STATE_KEY]: 'library',
              [NAVIGATION_PAGE_STATE_KEY]: 'discover',
            },
            '',
          );
        }
        setLibraryPage('discover');
        return;
      }

      const method = currentPage === 'discover' ? 'pushState' : 'replaceState';
      window.history[method](
        {
          [NAVIGATION_STATE_KEY]: 'library',
          [NAVIGATION_PAGE_STATE_KEY]: nextPage,
        },
        '',
      );
      setLibraryPage(nextPage);
    },
    [libraryPage],
  );

  const visibleSearchItems = useMemo(
    () => filterAndSortManga(searchItems, appliedFilters),
    [appliedFilters, searchItems],
  );
  const allLoadedItems = useMemo(
    () =>
      deduplicateManga([
        ...COLLECTION_SORTS.flatMap((order) => discoverCollections[order].items),
        ...searchItems,
      ]),
    [discoverCollections, searchItems],
  );
  const favorites = useMemo(() => favoriteEntries.map((entry) => entry.mangaId), [favoriteEntries]);
  const favoriteItems = useMemo(
    () =>
      deduplicateManga([
        ...history.filter(hasCompleteHistoryMetadata).map(mangaFromReadingProgress),
        ...allLoadedItems,
        ...favoriteCatalog,
      ]).filter((manga) => favorites.includes(manga.id)),
    [allLoadedItems, favoriteCatalog, favorites, history],
  );
  const metadataSuggestions = useMemo(
    () => collectMetadataSuggestions(allLoadedItems),
    [allLoadedItems],
  );
  const updateCount = useMemo(
    () => history.filter(hasCompleteHistoryMetadata).filter(hasNewChapter).length,
    [history],
  );

  const loadFavoriteMetadata = useCallback(async (mangaIds: readonly number[]) => {
    if (mangaIds.length === 0) {
      setFavoriteCatalogFailures(0);
      return;
    }
    setFavoriteCatalogLoading(true);
    setFavoriteCatalogFailures(0);
    try {
      const result = await loadFavoriteCatalog(mangaIds);
      const library = updateHistoryCatalog(result.manga);
      setFavoriteCatalog((current) => deduplicateManga([...current, ...result.manga]));
      setFavoriteEntries(library.favorites);
      setFavoriteCatalogFailures(result.failed);
    } finally {
      setFavoriteCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    if (libraryPage !== 'history') return;
    const knownIds = new Set(favoriteItems.map((manga) => manga.id));
    const missingIds = favorites.filter(
      (mangaId) => !knownIds.has(mangaId) && !favoriteAttemptedIdsRef.current.has(mangaId),
    );
    if (missingIds.length === 0) return;
    missingIds.forEach((mangaId) => favoriteAttemptedIdsRef.current.add(mangaId));
    void loadFavoriteMetadata(missingIds);
  }, [favoriteItems, favorites, libraryPage, loadFavoriteMetadata]);

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
    // 旧保存形式の履歴は、実データを取得できるまで仮の作品情報を表示しない。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void restoreHistoryMetadata();
  }, [restoreHistoryMetadata]);

  useEffect(() => {
    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    window.history.replaceState(
      {
        [NAVIGATION_STATE_KEY]: 'library',
        [NAVIGATION_PAGE_STATE_KEY]: 'discover',
      },
      '',
    );
    const handlePopState = (event: PopStateEvent) => {
      const nextScreen = getNavigationScreen(event.state) ?? 'library';
      setScreen(nextScreen);
      if (nextScreen === 'library') {
        setLibraryPage(getNavigationLibraryPage(event.state) ?? 'discover');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  const submitSearch = (filters: MangaFilters) => {
    setDraftFilters(filters);
    setAppliedFilters(filters);
    if (!hasSearchCriteria(filters)) {
      setSearchItems([]);
      setSearchError(undefined);
      setSearchStarted(false);
      setSearchPage(1);
      setSearchHasMore(false);
      return;
    }
    setSearchStarted(true);
    navigateLibraryPage('search');
    void loadSearch(1, false, filters);
  };

  const runSearch = (event: FormEvent) => {
    event.preventDefault();
    const nextFilters = { ...draftFilters, keyword: query.trim() };
    submitSearch(nextFilters);
  };

  const applyAdvancedFilters = () => {
    const nextFilters = { ...draftFilters, keyword: query.trim() };
    submitSearch(nextFilters);
  };

  const clearDraftFilters = () => {
    setDraftFilters((current) => ({
      ...createDefaultMangaFilters(current.keyword),
      sortBy: current.sortBy,
      direction: current.direction,
    }));
  };

  const changeSearchSort = (sortBy: MangaSortKey, direction: SortDirection) => {
    setDraftFilters((current) => ({ ...current, sortBy, direction }));
    setAppliedFilters((current) => ({ ...current, sortBy, direction }));
  };

  const openManga = async (manga: Manga, addHistoryEntry = true) => {
    const hasReadingHistory = getProgress(manga.id) !== undefined;
    setSelected(manga);
    setChapters([]);
    setDetailError(undefined);
    setDetailLoading(true);
    if (addHistoryEntry) navigateForward('detail');
    else setScreen('detail');
    try {
      const [detail, chapterList] = await Promise.all([getManga(manga.id), getChapters(manga.id)]);
      setSelected(detail);
      setChapters(chapterList);
      if (!hasReadingHistory) void prefetchChapterEdges(chapterList);
    } catch (caught: unknown) {
      setDetailError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setDetailLoading(false);
    }
  };

  const updateFavorite = (manga: Manga) => {
    const nextFavorites = toggleFavorite(manga);
    if (nextFavorites.some((entry) => entry.mangaId === manga.id)) {
      favoriteAttemptedIdsRef.current.delete(manga.id);
    }
    setFavoriteEntries(nextFavorites);
  };
  const startReading = (chapter: number, savedPage = 0) => {
    const target = chapters[chapter];
    const safePage = Math.min(
      Math.max(savedPage, 0),
      Math.max(0, (target?.content.length ?? 1) - 1),
    );
    setReaderStart({ chapter, page: safePage });
    navigateForward('reader');
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

  const getHistoryManga = (entry: ReadingProgress): Manga => {
    const knownManga = allLoadedItems.find((item) => item.id === entry.mangaId);
    return knownManga ?? mangaFromReadingProgress(entry);
  };

  const openHistoryEntry = async (entry: ReadingProgress) => {
    const summary = getHistoryManga(entry);
    setDetailLoading(true);
    setDetailError(undefined);
    try {
      const [detail, chapterList] = await Promise.all([
        getManga(entry.mangaId),
        getChapters(entry.mangaId),
      ]);
      const chapterIndex = Math.max(
        0,
        chapterList.findIndex((item) => item.chapter === entry.chapter),
      );
      const chapter = chapterList[chapterIndex];
      const safePage = Math.min(
        Math.max(entry.page, 0),
        Math.max(0, (chapter?.content.length ?? 1) - 1),
      );
      setSelected(detail);
      setChapters(chapterList);
      setReaderStart({ chapter: chapterIndex, page: safePage });
      navigateForward('reader');
    } catch (caught: unknown) {
      setSelected(summary);
      setChapters([]);
      setDetailError(caught instanceof Error ? caught.message : String(caught));
      navigateForward('detail');
    } finally {
      setDetailLoading(false);
    }
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
        onClose={() => navigateBack('detail')}
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
        onBack={() => navigateBack('library')}
        onFavorite={() => updateFavorite(selected)}
        onRead={startReading}
        onRetry={() => void openManga(selected, false)}
        t={t}
      />
    );
  }

  return (
    <div className={`app-shell page-${libraryPage}`}>
      <header className="topbar">
        <button className="brand" type="button" onClick={() => navigateLibraryPage('discover')}>
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
        onNavigate={navigateLibraryPage}
        t={t}
      />
      <main id="top" className="library-view">
        {libraryPage === 'discover' && (
          <>
            <PageHeading title={t('discover')} hint={t('libraryHint')} eyebrow="YOUR READING ROOM">
              <div className="sort-tabs" role="group">
                {COLLECTION_SORTS.map((value) => (
                  <button
                    key={value}
                    className={sort === value ? 'active' : ''}
                    onClick={() => {
                      if (sort === value) return;
                      setSort(value);
                      const collection = discoverCollections[value];
                      if (
                        collection.items.length === 0 &&
                        !collection.loading &&
                        !collection.error
                      ) {
                        void loadDiscover(1, value);
                      }
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
              canLoadMore={Boolean(discoverPrefetchedPage)}
              loadMoreError={discoverHasMore ? discoverPrefetchError : undefined}
              favorites={favorites}
              onOpen={(manga) => void openManga(manga)}
              onFavorite={updateFavorite}
              onRetry={() => void loadDiscover(discoverPage, sort)}
              onRetryLoadMore={() => void prefetchDiscover(discoverPage + 1, sort)}
              onLoadMore={() => {
                if (discoverPrefetchedPage) {
                  revealPrefetchedDiscover(sort, discoverPrefetchedPage);
                }
              }}
              t={t}
            />
          </>
        )}

        {libraryPage === 'search' && (
          <>
            <AdvancedSearch
              filters={draftFilters}
              appliedFilters={appliedFilters}
              suggestions={metadataSuggestions}
              onChange={(key, value) =>
                setDraftFilters((current) => ({ ...current, [key]: value }) as MangaFilters)
              }
              onApply={applyAdvancedFilters}
              onApplyFilters={submitSearch}
              onSortChange={changeSearchSort}
              onClearDraft={clearDraftFilters}
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
            <div className="history-stack">
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
              <FavoritesPanel
                items={favoriteItems}
                savedTitles={favoriteEntries
                  .filter(
                    (entry) =>
                      entry.title.length > 0 &&
                      !favoriteItems.some((manga) => manga.id === entry.mangaId),
                  )
                  .map((entry) => entry.title)}
                favoriteCount={favorites.length}
                loading={favoriteCatalogLoading}
                failed={favoriteCatalogFailures}
                onOpen={(manga) => void openManga(manga)}
                onFavorite={updateFavorite}
                onRetry={() =>
                  void loadFavoriteMetadata(
                    favorites.filter(
                      (mangaId) => !favoriteItems.some((manga) => manga.id === mangaId),
                    ),
                  )
                }
                t={t}
              />
            </div>
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
              <ChapterUpdatesPanel
                history={history}
                locale={locale}
                lastUpdateCheckAt={lastUpdateCheckAt}
                checkingUpdates={checkingUpdates}
                updateCheckFailures={updateCheckFailures}
                onOpen={(entry) => void openManga(getHistoryManga(entry))}
                onCheckUpdates={() => void refreshChapterUpdates()}
                t={t}
              />
              <AppUpdaterPanel t={t} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function getNavigationScreen(state: unknown): Screen | undefined {
  if (!state || typeof state !== 'object') return undefined;
  const value = Reflect.get(state, NAVIGATION_STATE_KEY);
  return value === 'library' || value === 'detail' || value === 'reader' ? value : undefined;
}

function getNavigationLibraryPage(state: unknown): LibraryPage | undefined {
  if (!state || typeof state !== 'object') return undefined;
  const value = Reflect.get(state, NAVIGATION_PAGE_STATE_KEY);
  return value === 'discover' || value === 'search' || value === 'history' || value === 'updates'
    ? value
    : undefined;
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
  hasMore?: boolean;
  canLoadMore?: boolean;
  loadMoreError?: string;
  favorites: number[];
  onOpen: (manga: Manga) => void;
  onFavorite: (manga: Manga) => void;
  onRetry: () => void;
  onRetryLoadMore?: () => void;
  onLoadMore: () => void;
  t: ReturnType<typeof createTranslator>;
}

function MangaResults({
  items,
  loadedCount,
  loading,
  error,
  hasMore,
  canLoadMore,
  loadMoreError,
  favorites,
  onOpen,
  onFavorite,
  onRetry,
  onRetryLoadMore,
  onLoadMore,
  t,
}: MangaResultsProps) {
  const loadMoreReady = canLoadMore ?? hasMore ?? false;
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
      {!loading && !error && loadedCount > 0 && loadMoreError && onRetryLoadMore && (
        <div className="status-panel error-panel">
          <p>{loadMoreError}</p>
          <button onClick={onRetryLoadMore}>{t('retry')}</button>
        </div>
      )}
      {!loading && !error && loadedCount > 0 && loadMoreReady && (
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

function mangaFromReadingProgress(entry: ReadingProgress): Manga {
  return {
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
}

function collectMetadataSuggestions(items: readonly Manga[]): MetadataSuggestions {
  const collect = (values: string[]) =>
    [...new Set(values.map((value) => value.trim()).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right, 'ja', { sensitivity: 'base' }))
      .slice(0, 300);
  const collectByFrequency = (values: string[]) => {
    const counts = new Map<string, { count: number; value: string }>();
    for (const value of values.flatMap((entry) => entry.split(','))) {
      const trimmed = value.trim();
      if (!trimmed) continue;
      const key = trimmed.normalize('NFKC').toLocaleLowerCase();
      const current = counts.get(key);
      counts.set(key, { count: (current?.count ?? 0) + 1, value: current?.value ?? trimmed });
    }
    return [...counts.values()]
      .sort(
        (left, right) =>
          right.count - left.count ||
          left.value.localeCompare(right.value, 'ja', { sensitivity: 'base' }),
      )
      .map(({ value }) => value)
      .slice(0, 300);
  };
  return {
    authors: collect(items.map((manga) => manga.authors)),
    artists: collect(items.map((manga) => manga.artists)),
    genres: collectByFrequency(items.map((manga) => manga.genres)),
    magazines: collect(items.map((manga) => manga.magazines)),
    translationGroups: collect(items.map((manga) => manga.transGroup)),
  };
}
