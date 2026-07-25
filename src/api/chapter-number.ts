export type ChapterNumber = string | number;

const CHAPTER_NUMBER_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

export function isChapterNumber(value: unknown): value is ChapterNumber {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 && CHAPTER_NUMBER_PATTERN.test(String(value));
  }
  return typeof value === 'string' && CHAPTER_NUMBER_PATTERN.test(value);
}

export function chapterNumbersEqual(left: ChapterNumber, right: ChapterNumber): boolean {
  return String(left) === String(right);
}

export function compareChapterNumbers(left: ChapterNumber, right: ChapterNumber): number {
  const [leftInteger = '0', leftFraction = ''] = String(left).split('.');
  const [rightInteger = '0', rightFraction = ''] = String(right).split('.');

  const integerComparison = compareDigits(leftInteger, rightInteger);
  if (integerComparison !== 0) return integerComparison;

  const fractionLength = Math.max(leftFraction.length, rightFraction.length);
  return compareDigits(
    leftFraction.padEnd(fractionLength, '0'),
    rightFraction.padEnd(fractionLength, '0'),
  );
}

export function maxChapterNumber(first: ChapterNumber, ...rest: ChapterNumber[]): ChapterNumber {
  return rest.reduce(
    (latest, chapter) => (compareChapterNumbers(chapter, latest) > 0 ? chapter : latest),
    first,
  );
}

export function findChapterNumberIndex<T extends { chapter: ChapterNumber }>(
  chapters: readonly T[],
  target: ChapterNumber,
): number {
  const exactIndex = chapters.findIndex((item) => chapterNumbersEqual(item.chapter, target));
  if (exactIndex >= 0) return exactIndex;

  const truncatedLabel = String(target);
  if (!/^\d+$/.test(truncatedLabel)) return -1;
  for (let index = chapters.length - 1; index >= 0; index -= 1) {
    if (String(chapters[index]!.chapter).startsWith(`${truncatedLabel}.`)) return index;
  }
  return -1;
}

export function restoreTruncatedChapterNumbers<T extends { chapter: ChapterNumber }>(
  chapters: readonly T[],
  lastChapter: ChapterNumber,
): T[] {
  const groups = new Map<string, number[]>();
  chapters.forEach((chapter, index) => {
    const label = String(chapter.chapter);
    if (!/^\d+$/.test(label)) return;
    const indexes = groups.get(label) ?? [];
    indexes.push(index);
    groups.set(label, indexes);
  });

  const [lastInteger, lastFraction] = String(lastChapter).split('.');
  const restored = [...chapters];
  for (const [integer, indexes] of groups) {
    const isLastChapterGroup = integer === lastInteger && lastFraction !== undefined;
    if (indexes.length === 1 && !isLastChapterGroup) continue;
    if (indexes.length === 1 && isLastChapterGroup) {
      const chapterIndex = indexes[0]!;
      restored[chapterIndex] = {
        ...chapters[chapterIndex]!,
        chapter: String(lastChapter),
      };
      continue;
    }

    const lastPart = isLastChapterGroup ? Number.parseInt(lastFraction, 10) : indexes.length;
    const firstPart =
      Number.isSafeInteger(lastPart) && lastPart >= indexes.length
        ? lastPart - indexes.length + 1
        : 1;

    indexes.forEach((chapterIndex, offset) => {
      const part = firstPart + offset;
      const chapter = chapters[chapterIndex]!;
      const fraction =
        isLastChapterGroup && lastFraction.length > 1
          ? String(part).padStart(lastFraction.length, '0')
          : String(part);
      restored[chapterIndex] = {
        ...chapter,
        chapter: `${integer}.${fraction}`,
      };
    });
  }
  return restored;
}

function compareDigits(left: string, right: string): number {
  const normalizedLeft = left.replace(/^0+(?=\d)/, '');
  const normalizedRight = right.replace(/^0+(?=\d)/, '');
  if (normalizedLeft.length !== normalizedRight.length) {
    return normalizedLeft.length - normalizedRight.length;
  }
  return normalizedLeft.localeCompare(normalizedRight);
}
