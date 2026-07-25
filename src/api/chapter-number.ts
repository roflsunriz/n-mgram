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

function compareDigits(left: string, right: string): number {
  const normalizedLeft = left.replace(/^0+(?=\d)/, '');
  const normalizedRight = right.replace(/^0+(?=\d)/, '');
  if (normalizedLeft.length !== normalizedRight.length) {
    return normalizedLeft.length - normalizedRight.length;
  }
  return normalizedLeft.localeCompare(normalizedRight);
}
