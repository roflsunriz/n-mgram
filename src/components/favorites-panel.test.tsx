// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Manga } from '../api/client';
import { createTranslator } from '../i18n';
import { FavoritesPanel } from './favorites-panel';

const favorite = {
  id: 7,
  name: 'お気に入り作品',
  cover: 'https://ihlv1.xyz/cover.webp',
  lastChapter: '4',
  authors: '作者',
} as Manga;

afterEach(cleanup);

describe('FavoritesPanel', () => {
  it('shows favorite titles and lets the user open or remove one', () => {
    const onOpen = vi.fn();
    const onFavorite = vi.fn();
    render(
      <FavoritesPanel
        items={[favorite]}
        savedTitles={[]}
        favoriteCount={1}
        loading={false}
        failed={0}
        onOpen={onOpen}
        onFavorite={onFavorite}
        onRetry={vi.fn()}
        t={createTranslator('ja')}
      />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'お気に入り作品' })[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'お気に入り解除' }));
    expect(onOpen).toHaveBeenCalledWith(favorite);
    expect(onFavorite).toHaveBeenCalledWith(favorite);
  });

  it('keeps saved titles visible when catalog metadata cannot be loaded', () => {
    render(
      <FavoritesPanel
        items={[]}
        savedTitles={['保存済みタイトル']}
        favoriteCount={1}
        loading={false}
        failed={1}
        onOpen={vi.fn()}
        onFavorite={vi.fn()}
        onRetry={vi.fn()}
        t={createTranslator('ja')}
      />,
    );

    expect(screen.getByText('保存済みタイトル')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('1件');
  });
});
