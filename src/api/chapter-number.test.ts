import { describe, expect, it } from 'vitest';
import {
  chapterNumbersEqual,
  compareChapterNumbers,
  findChapterNumberIndex,
  maxChapterNumber,
  restoreTruncatedChapterNumbers,
  type ChapterNumber,
} from './chapter-number';

describe('chapter numbers', () => {
  it('orders decimal chapter labels without converting them to JavaScript numbers', () => {
    const chapters: ChapterNumber[] = ['1.2', '1.01', '2', '1.1'];

    expect(chapters.sort(compareChapterNumbers)).toEqual(['1.01', '1.1', '1.2', '2']);
  });

  it('keeps differently written chapter labels distinct', () => {
    expect(chapterNumbersEqual('1.01', '1.1')).toBe(false);
    expect(chapterNumbersEqual('1.10', '1.1')).toBe(false);
    expect(chapterNumbersEqual(1.1, '1.1')).toBe(true);
  });

  it('returns the original label for the greatest chapter', () => {
    expect(maxChapterNumber('1.01', '1.2', '1.1')).toBe('1.2');
  });

  it('matches legacy integer history to the latest restored fractional chapter', () => {
    const chapters = ['1.1', '1.2', '2'].map((chapter) => ({ chapter }));

    expect(findChapterNumberIndex(chapters, 1)).toBe(1);
    expect(findChapterNumberIndex(chapters, 2)).toBe(2);
  });

  it('restores fractional labels truncated by the chapter list API', () => {
    const chapters = [1, 1, 1, 2, 2, 3, 3].map((chapter) => ({ chapter }));

    expect(restoreTruncatedChapterNumbers(chapters, '3.2').map((item) => item.chapter)).toEqual([
      '1.1',
      '1.2',
      '1.3',
      '2.1',
      '2.2',
      '3.1',
      '3.2',
    ]);
  });

  it('uses the manga latest chapter to restore a single truncated fractional label', () => {
    expect(restoreTruncatedChapterNumbers([{ chapter: 68 }], '68.01')).toEqual([
      { chapter: '68.01' },
    ]);
  });

  it('leaves chapter labels that the API returned exactly unchanged', () => {
    const chapters = [{ chapter: '1.01' }, { chapter: '1.1' }, { chapter: 2 }];

    expect(restoreTruncatedChapterNumbers(chapters, 2)).toEqual(chapters);
  });
});
