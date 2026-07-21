// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Chapter, Manga } from '../api/client';
import { createTranslator } from '../i18n';
import { DetailView } from './detail-view';

afterEach(cleanup);

const manga: Manga = {
  id: 1,
  name: 'Order Test',
  slug: '',
  authors: '',
  transGroup: '',
  artists: '',
  released: 0,
  otherName: '',
  genres: '',
  description: '',
  mStatus: 0,
  lastUpdate: '',
  post: '',
  cover: 'https://ihlv1.xyz/cover.webp',
  lastChapter: '3',
  views: 0,
  submitter: 0,
  groupUploader: 0,
  hidden: 0,
  magazines: '',
};

const chapters: Chapter[] = [1, 2, 3].map((chapter) => ({
  mid: 1,
  name: manga.name,
  chapter,
  content: [`https://ihlv1.xyz/${chapter}.webp`],
  time: '',
  views: 0,
}));

describe('DetailView chapter order', () => {
  it('starts newest-first and toggles to oldest-first without changing chapter indexes', () => {
    const onRead = vi.fn();
    render(
      <DetailView
        manga={manga}
        chapters={chapters}
        favorite={false}
        loading={false}
        onBack={vi.fn()}
        onFavorite={vi.fn()}
        onRead={onRead}
        onRetry={vi.fn()}
        t={createTranslator('ja')}
      />,
    );

    const chapterLabels = () =>
      [...document.querySelectorAll('.chapter-number')].map((element) => element.textContent);
    expect(chapterLabels()).toEqual(['第3話', '第2話', '第1話']);

    fireEvent.click(screen.getByTestId('chapter-order-toggle'));
    expect(chapterLabels()).toEqual(['第1話', '第2話', '第3話']);
    fireEvent.click(screen.getByRole('button', { name: /第1話/ }));
    expect(onRead).toHaveBeenCalledWith(0);
  });
});
