export interface ReaderSpread {
  start: number;
  end: number;
  right: number;
  left?: number;
}

export function getReaderSpread(pageIndex: number, pageCount: number): ReaderSpread {
  const lastPage = Math.max(0, pageCount - 1);
  const current = Math.min(Math.max(0, pageIndex), lastPage);

  if (current === 0) {
    return { start: 0, end: 0, right: 0 };
  }

  const start = current % 2 === 0 ? current - 1 : current;
  const end = Math.min(start + 1, lastPage);
  return {
    start,
    end,
    right: start,
    ...(end > start ? { left: end } : {}),
  };
}

export function getNextSpreadStart(pageIndex: number, pageCount: number): number | undefined {
  const spread = getReaderSpread(pageIndex, pageCount);
  const next = spread.start === 0 ? 1 : spread.start + 2;
  return next < pageCount ? next : undefined;
}

export function getPreviousSpreadStart(pageIndex: number, pageCount: number): number | undefined {
  const spread = getReaderSpread(pageIndex, pageCount);
  if (spread.start === 0) return undefined;
  return spread.start <= 1 ? 0 : spread.start - 2;
}

export function getLastSpreadStart(pageCount: number): number {
  return getReaderSpread(Math.max(0, pageCount - 1), pageCount).start;
}
