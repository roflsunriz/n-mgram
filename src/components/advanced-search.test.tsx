// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../i18n';
import { createDefaultMangaFilters } from '../search/manga-search';
import { AdvancedSearch } from './advanced-search';

afterEach(cleanup);

const suggestions = {
  authors: ['Author A'],
  artists: ['Artist A'],
  genres: ['action'],
  magazines: ['Magazine A'],
  translationGroups: ['Group A'],
};

function renderSearch(overrides: Partial<React.ComponentProps<typeof AdvancedSearch>> = {}) {
  const filters = createDefaultMangaFilters();
  const props: React.ComponentProps<typeof AdvancedSearch> = {
    filters,
    appliedFilters: filters,
    suggestions,
    onChange: vi.fn(),
    onApply: vi.fn(),
    onApplyFilters: vi.fn(),
    onSortChange: vi.fn(),
    onClearDraft: vi.fn(),
    t: createTranslator('ja'),
    ...overrides,
  };
  render(<AdvancedSearch {...props} />);
  return props;
}

describe('AdvancedSearch', () => {
  it('shows only reader-facing filters and keeps technical metadata out of the UI', () => {
    renderSearch();

    expect(document.querySelector('[data-filter-field="genres"]')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'すべて' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /^コモン/ })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /^レジェンダリー/ })).toBeTruthy();
    expect(screen.getByTestId('search-sort')).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'APIの関連順' })).toBeNull();
    expect(screen.queryByRole('radio', { name: '完結' })).toBeNull();

    for (const hiddenField of [
      'slug',
      'mangaId',
      'submitter',
      'groupUploader',
      'cover',
      'releasedFrom',
      'releasedTo',
    ]) {
      expect(document.querySelector(`[data-filter-field="${hiddenField}"]`)).toBeNull();
    }
  });

  it('stages filter changes and sends them only from the result action', () => {
    const onChange = vi.fn();
    const onApply = vi.fn();
    const onClearDraft = vi.fn();
    renderSearch({ onChange, onApply, onClearDraft });

    fireEvent.change(document.querySelector('[data-filter-field="genres"]')!, {
      target: { value: 'fantasy' },
    });
    fireEvent.click(screen.getByRole('radio', { name: /レア/ }));
    fireEvent.click(screen.getByRole('button', { name: 'action' }));

    expect(onChange).toHaveBeenCalledWith('genres', 'fantasy');
    expect(onChange).toHaveBeenCalledWith('chapterLength', 'rare');
    expect(onChange).toHaveBeenCalledWith('genres', 'action');
    expect(onApply).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('apply-filters'));
    fireEvent.click(screen.getByTestId('reset-filters'));
    expect(onApply).toHaveBeenCalledOnce();
    expect(onClearDraft).toHaveBeenCalledOnce();
  });

  it('shows removable applied filters and changes sorting without submitting another search', () => {
    const onApplyFilters = vi.fn();
    const onSortChange = vi.fn();
    const appliedFilters = {
      ...createDefaultMangaFilters('magic'),
      genres: 'action',
      chapterLength: 'legendary' as const,
    };
    renderSearch({ appliedFilters, filters: appliedFilters, onApplyFilters, onSortChange });

    expect(screen.getByText('2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'actionを解除' }));
    expect(onApplyFilters).toHaveBeenCalledWith(expect.objectContaining({ genres: '' }));
    fireEvent.click(screen.getByRole('button', { name: 'チャプター数: レジェンダリーを解除' }));
    expect(onApplyFilters).toHaveBeenCalledWith(expect.objectContaining({ chapterLength: 'any' }));

    fireEvent.change(screen.getByTestId('search-sort'), { target: { value: 'views:desc' } });
    expect(onSortChange).toHaveBeenCalledWith('views', 'desc');
  });
});
