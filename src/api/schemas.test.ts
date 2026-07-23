import { describe, expect, it } from 'vitest';
import { chapterListSchema, descriptionToPlainText, mangaSchema } from './client';

describe('API schemas', () => {
  it('accepts a valid manga response and normalizes lastChapter', () => {
    const parsed = mangaSchema.parse({
      id: 1,
      name: 'Title',
      cover: 'https://ihlv1.xyz/cover.webp',
      lastChapter: 12,
      slug: '',
      authors: '',
      artists: '',
      otherName: '',
      genres: '',
      description: '',
      lastUpdate: '',
      views: 0,
    });
    expect(parsed.lastChapter).toBe('12');
  });

  it('normalizes a missing update date returned by newest titles', () => {
    const parsed = mangaSchema.parse({
      id: 8293,
      name: 'Newest title',
      cover: 'https://s4.ihlv1.xyz/images4/cover.webp',
      lastChapter: '0',
      lastUpdate: null,
    });
    expect(parsed.lastUpdate).toBe('');
  });

  it('retains every metadata field available in current collection responses', () => {
    const parsed = mangaSchema.parse({
      id: 987,
      name: 'Title',
      slug: 'title',
      authors: 'Author',
      transGroup: 'Group',
      artists: 'Artist',
      released: 2024,
      otherName: '別名',
      genres: 'action,fantasy',
      description: 'Description',
      mStatus: 2,
      views: 42589,
      lastUpdate: '2026-07-21T19:35:01Z',
      post: '2021-01-02T00:00:00Z',
      cover: 'https://s4.ihlv1.xyz/cover.webp',
      lastChapter: '55.2',
      submitter: 1,
      groupUploader: 2,
      hidden: 0,
      magazines: 'Magazine',
    });
    expect(parsed).toMatchObject({
      transGroup: 'Group',
      released: 2024,
      mStatus: 2,
      post: '2021-01-02T00:00:00Z',
      submitter: 1,
      groupUploader: 2,
      hidden: 0,
      magazines: 'Magazine',
    });
  });

  it('rejects unsafe image protocols', () => {
    expect(() =>
      mangaSchema.parse({ id: 1, name: 'Title', cover: 'javascript:alert(1)', lastChapter: '1' }),
    ).toThrow();
  });

  it('discards only malformed pages from chapter content', () => {
    const parsed = chapterListSchema.parse([
      {
        mid: 1,
        name: 'Title',
        chapter: 1,
        content: ['https://ihlv1.xyz/1.webp', '', 'not-a-url'],
        time: '',
        views: 0,
      },
    ]);
    expect(parsed[0]?.content).toEqual(['https://ihlv1.xyz/1.webp']);
  });

  it('rewrites pages from the retired imfaclub CDN to the matching live ihlv1 host', () => {
    const parsed = chapterListSchema.parse([
      {
        mid: 2053,
        name: 'GHOST IN THE SHELL - THE HUMAN ALGORITHM - RAW',
        chapter: 1,
        content: ['https://s2.imfaclub.com/images/20200303/dfc8902340a3a2ac38bdea58f32eba2f00.jpg'],
        time: '',
        views: 0,
      },
    ]);
    expect(parsed[0]?.content).toEqual([
      'https://s2.ihlv1.xyz/images/20200303/dfc8902340a3a2ac38bdea58f32eba2f00.jpg',
    ]);
  });

  it('accepts covers from the current jfimv2 CDN without changing their path', () => {
    const cover = 'https://j4.jfimv2.xyz/images3/20250924/image_68d3b6fd10897.png';
    const parsed = mangaSchema.parse({
      id: 6286,
      name: 'SEIRYAKU YORI AI WO ERANDA KEKKON',
      cover,
      lastChapter: '10',
    });
    expect(parsed.cover).toBe(cover);
  });

  it('does not rewrite a hostname that only resembles the retired CDN', () => {
    const cover = 'https://imfaclub.com.example.invalid/cover.webp';
    const parsed = mangaSchema.parse({
      id: 1,
      name: 'Lookalike host',
      cover,
      lastChapter: '1',
    });
    expect(parsed.cover).toBe(cover);
  });

  it('removes the known translator recruitment image URL from chapters', () => {
    const parsed = chapterListSchema.parse([
      {
        mid: 1,
        name: 'Title',
        chapter: 1,
        content: [
          'https://ihlv1.xyz/1.webp',
          'https://example.invalid/new/path/image_5f0ecf23aed2e.png?copy=1',
        ],
        time: '',
        views: 0,
      },
    ]);
    expect(parsed[0]?.content).toEqual(['https://ihlv1.xyz/1.webp']);
  });

  it('converts API description HTML into safe readable text', () => {
    expect(
      descriptionToPlainText(
        '<div class=sContent>Hello<br />World &amp; friends</div><script>bad()</script>',
      ),
    ).toBe('Hello\nWorld & friends');
  });
});
