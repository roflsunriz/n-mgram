import { getManga, type Manga } from '../api/client';

export interface FavoriteCatalogLoadResult {
  manga: Manga[];
  failed: number;
}

export async function loadFavoriteCatalog(
  mangaIds: readonly number[],
  fetchManga: (id: number) => Promise<Manga> = getManga,
  concurrency = 3,
): Promise<FavoriteCatalogLoadResult> {
  const manga: Manga[] = [];
  let failed = 0;
  let cursor = 0;
  const workerCount = Math.min(Math.max(1, concurrency), mangaIds.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (cursor < mangaIds.length) {
        const mangaId = mangaIds[cursor];
        cursor += 1;
        if (mangaId === undefined) continue;
        try {
          manga.push(await fetchManga(mangaId));
        } catch {
          failed += 1;
        }
      }
    }),
  );

  return { manga, failed };
}
