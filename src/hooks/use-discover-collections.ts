import { useCallback, useEffect, useRef, useState } from 'react';
import { getCollection, type CollectionSort, type Manga } from '../api/client';

const COLLECTION_PAGE_SIZE = 24;
const BACKGROUND_COVER_PRELOAD_COUNT = 12;

export const COLLECTION_SORTS = [
  'update',
  'new',
  'top',
] as const satisfies readonly CollectionSort[];

interface PrefetchedDiscoverPage {
  page: number;
  items: Manga[];
  hasMore: boolean;
}

export interface DiscoverCollection {
  items: Manga[];
  page: number;
  hasMore: boolean;
  loading: boolean;
  prefetchedPage?: PrefetchedDiscoverPage;
  prefetchingPage?: number;
  prefetchError?: string;
  error?: string;
}

function createDiscoverCollections(): Record<CollectionSort, DiscoverCollection> {
  const createCollection = (): DiscoverCollection => ({
    items: [],
    page: 1,
    hasMore: true,
    loading: true,
  });
  return {
    update: createCollection(),
    new: createCollection(),
    top: createCollection(),
  };
}

function deduplicateManga(items: readonly Manga[]): Manga[] {
  return [...new Map(items.map((manga) => [manga.id, manga])).values()];
}

function preloadCollectionCovers(items: readonly Manga[]): void {
  for (const manga of items.slice(0, BACKGROUND_COVER_PRELOAD_COUNT)) {
    const image = new Image();
    image.decoding = 'async';
    image.fetchPriority = 'low';
    image.src = manga.cover;
  }
}

export function useDiscoverCollections(onLoaded: (items: Manga[]) => void) {
  const [collections, setCollections] = useState(createDiscoverCollections);
  const pageRequestsRef = useRef(new Map<string, Promise<Manga[]>>());

  const fetchPage = useCallback(
    (page: number, order: CollectionSort): Promise<Manga[]> => {
      const requestKey = `${order}:${page}`;
      const existingRequest = pageRequestsRef.current.get(requestKey);
      if (existingRequest) return existingRequest;

      const request = getCollection(page, order, COLLECTION_PAGE_SIZE).then((result) => {
        onLoaded(result);
        return result;
      });
      pageRequestsRef.current.set(requestKey, request);
      const clearRequest = () => {
        if (pageRequestsRef.current.get(requestKey) === request) {
          pageRequestsRef.current.delete(requestKey);
        }
      };
      void request.then(clearRequest, clearRequest);
      return request;
    },
    [onLoaded],
  );

  const prefetch = useCallback(
    async (nextPage: number, order: CollectionSort): Promise<void> => {
      setCollections((current) => ({
        ...current,
        [order]: {
          ...current[order],
          prefetchedPage: undefined,
          prefetchingPage: nextPage,
          prefetchError: undefined,
        },
      }));
      try {
        const result = await fetchPage(nextPage, order);
        preloadCollectionCovers(result);
        setCollections((current) => {
          const collection = current[order];
          if (collection.prefetchingPage !== nextPage || collection.page + 1 !== nextPage) {
            return current;
          }
          return {
            ...current,
            [order]: {
              ...collection,
              hasMore: result.length > 0,
              prefetchedPage:
                result.length > 0
                  ? {
                      page: nextPage,
                      items: result,
                      hasMore: result.length >= COLLECTION_PAGE_SIZE,
                    }
                  : undefined,
              prefetchingPage: undefined,
              prefetchError: undefined,
            },
          };
        });
      } catch (caught: unknown) {
        setCollections((current) => {
          const collection = current[order];
          if (collection.prefetchingPage !== nextPage) return current;
          return {
            ...current,
            [order]: {
              ...collection,
              prefetchingPage: undefined,
              prefetchError: caught instanceof Error ? caught.message : String(caught),
            },
          };
        });
      }
    },
    [fetchPage],
  );

  const load = useCallback(
    async (page: number, order: CollectionSort): Promise<void> => {
      setCollections((current) => ({
        ...current,
        [order]: {
          ...current[order],
          loading: true,
          error: undefined,
          prefetchedPage: undefined,
          prefetchingPage: undefined,
          prefetchError: undefined,
        },
      }));
      try {
        const result = await fetchPage(page, order);
        if (page === 1 && order !== 'update') preloadCollectionCovers(result);
        const hasMore = result.length >= COLLECTION_PAGE_SIZE;
        setCollections((current) => ({
          ...current,
          [order]: {
            items: result,
            page,
            hasMore,
            loading: false,
          },
        }));
        if (hasMore) void prefetch(page + 1, order);
      } catch (caught: unknown) {
        setCollections((current) => ({
          ...current,
          [order]: {
            ...current[order],
            loading: false,
            error: caught instanceof Error ? caught.message : String(caught),
          },
        }));
      }
    },
    [fetchPage, prefetch],
  );

  const revealPrefetched = useCallback(
    (order: CollectionSort, prefetchedPage: PrefetchedDiscoverPage): void => {
      setCollections((current) => {
        const collection = current[order];
        if (collection.prefetchedPage?.page !== prefetchedPage.page) return current;
        return {
          ...current,
          [order]: {
            ...collection,
            items: deduplicateManga([...collection.items, ...prefetchedPage.items]),
            page: prefetchedPage.page,
            hasMore: prefetchedPage.hasMore,
            prefetchedPage: undefined,
            prefetchError: undefined,
          },
        };
      });
      if (prefetchedPage.hasMore) void prefetch(prefetchedPage.page + 1, order);
    },
    [prefetch],
  );

  useEffect(() => {
    // 3タブを同時に温め、以降のタブ切り替えでは取得待ちを発生させない。
    COLLECTION_SORTS.forEach((order) => void load(1, order));
  }, [load]);

  return {
    collections,
    load,
    prefetch,
    revealPrefetched,
  };
}
