import type { Chapter } from '../api/client';
import { compareChapterNumbers } from '../api/chapter-number';
import { acquirePageImage } from './page-image-cache';

const EDGE_PAGE_COUNT = 8;

export function getChapterEdgePageUrls(chapters: readonly Chapter[]): string[] {
  if (chapters.length === 0) return [];

  let oldest = chapters[0]!;
  let newest = chapters[0]!;
  for (const chapter of chapters.slice(1)) {
    if (compareChapterNumbers(chapter.chapter, oldest.chapter) < 0) oldest = chapter;
    if (compareChapterNumbers(chapter.chapter, newest.chapter) > 0) newest = chapter;
  }

  return [
    ...new Set([
      ...oldest.content.slice(0, EDGE_PAGE_COUNT),
      ...newest.content.slice(0, EDGE_PAGE_COUNT),
    ]),
  ];
}

export async function prefetchChapterEdges(chapters: readonly Chapter[]): Promise<void> {
  await Promise.allSettled(
    getChapterEdgePageUrls(chapters).map(async (url) => {
      const image = await acquirePageImage(url, new AbortController().signal, {
        priority: 'prefetch',
      });
      image.release();
    }),
  );
}
