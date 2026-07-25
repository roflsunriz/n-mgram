import { describe, expect, it } from 'vitest';
import {
  chapterNumbersEqual,
  compareChapterNumbers,
  maxChapterNumber,
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
});
