// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../i18n';
import { createDefaultMangaFilters, type MangaFilters } from '../search/manga-search';
import { AdvancedSearch } from './advanced-search';

afterEach(cleanup);

const suggestions = {
  authors: ['Author A'],
  artists: ['Artist A'],
  genres: ['action'],
  magazines: ['Magazine A'],
  translationGroups: ['Group A'],
};

describe('AdvancedSearch', () => {
  it('renders a stable control for every searchable metadata field', () => {
    render(
      <AdvancedSearch
        filters={createDefaultMangaFilters()}
        suggestions={suggestions}
        onChange={vi.fn()}
        onApply={vi.fn()}
        onReset={vi.fn()}
        t={createTranslator('ja')}
      />,
    );

    const fields: Array<keyof MangaFilters> = [
      'title',
      'otherName',
      'slug',
      'author',
      'artist',
      'genres',
      'magazine',
      'translationGroup',
      'description',
      'cover',
      'mangaId',
      'releasedFrom',
      'releasedTo',
      'viewsFrom',
      'viewsTo',
      'chapterFrom',
      'chapterTo',
      'postedFrom',
      'postedTo',
      'updatedFrom',
      'updatedTo',
      'submitter',
      'groupUploader',
      'status',
      'hidden',
      'sortBy',
      'direction',
    ];
    for (const field of fields)
      expect(document.querySelector(`[data-filter-field="${field}"]`)).toBeTruthy();
  });

  it('reports field changes and apply/reset actions', () => {
    const onChange = vi.fn();
    const onApply = vi.fn();
    const onReset = vi.fn();
    render(
      <AdvancedSearch
        filters={createDefaultMangaFilters()}
        suggestions={suggestions}
        onChange={onChange}
        onApply={onApply}
        onReset={onReset}
        t={createTranslator('ja')}
      />,
    );

    fireEvent.change(document.querySelector('[data-filter-field="artist"]')!, {
      target: { value: 'Artist A' },
    });
    fireEvent.change(document.querySelector('[data-filter-field="status"]')!, {
      target: { value: 'completed' },
    });
    fireEvent.click(screen.getByTestId('apply-filters'));
    fireEvent.click(screen.getByTestId('reset-filters'));

    expect(onChange).toHaveBeenCalledWith('artist', 'Artist A');
    expect(onChange).toHaveBeenCalledWith('status', 'completed');
    expect(onApply).toHaveBeenCalledOnce();
    expect(onReset).toHaveBeenCalledOnce();
  });
});
