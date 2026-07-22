import type { Chapter } from '../api/client';
import { acquirePageImage } from './page-image-cache';

const ACTIVE_FORWARD_WINDOW = 16;
const ACTIVE_BACKWARD_WINDOW = 4;
const NEXT_CHAPTER_HEAD = 12;
const FOLLOWING_CHAPTER_HEAD = 12;
const PREVIOUS_CHAPTER_TAIL = 8;
const PREFETCH_WORKERS = 6;

export function getReaderPrefetchPlan(
  chapters: readonly Chapter[],
  chapterIndex: number,
  pageIndex: number,
): string[] {
  const current = chapters[chapterIndex];
  if (!current) return [];

  const urls: string[] = [];
  const seen = new Set<string>();
  const add = (candidates: readonly string[]) => {
    for (const url of candidates) {
      if (!url || seen.has(url)) continue;
      seen.add(url);
      urls.push(url);
    }
  };
  const safePage = Math.min(Math.max(pageIndex, 0), Math.max(current.content.length - 1, 0));
  const next = chapters[chapterIndex + 1];
  const following = chapters[chapterIndex + 2];
  const previous = chapters[chapterIndex - 1];

  add(current.content.slice(safePage, safePage + ACTIVE_FORWARD_WINDOW));
  add(current.content.slice(Math.max(0, safePage - ACTIVE_BACKWARD_WINDOW), safePage));
  add(next?.content.slice(0, NEXT_CHAPTER_HEAD) ?? []);
  add(current.content.slice(safePage + ACTIVE_FORWARD_WINDOW));
  add(current.content.slice(0, Math.max(0, safePage - ACTIVE_BACKWARD_WINDOW)));
  add(next?.content.slice(NEXT_CHAPTER_HEAD) ?? []);
  add(following?.content.slice(0, FOLLOWING_CHAPTER_HEAD) ?? []);
  add(previous?.content.slice(-PREVIOUS_CHAPTER_TAIL).reverse() ?? []);

  return urls;
}

export async function prefetchReaderPages(
  chapters: readonly Chapter[],
  chapterIndex: number,
  pageIndex: number,
  signal: AbortSignal,
): Promise<void> {
  const plan = getReaderPrefetchPlan(chapters, chapterIndex, pageIndex);
  let cursor = 0;
  const worker = async () => {
    while (!signal.aborted) {
      const url = plan[cursor];
      cursor += 1;
      if (!url) return;
      try {
        const image = await acquirePageImage(url, signal, { priority: 'prefetch' });
        image.release();
      } catch {
        if (signal.aborted) return;
      }
    }
  };

  await Promise.allSettled(
    Array.from({ length: Math.min(PREFETCH_WORKERS, plan.length) }, () => worker()),
  );
}
