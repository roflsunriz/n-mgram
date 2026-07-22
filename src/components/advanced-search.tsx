import type { FormEvent } from 'react';
import type { MessageKey } from '../i18n';
import {
  type ChapterLengthTier,
  type MangaFilters,
  type MangaSortKey,
  type SortDirection,
} from '../search/manga-search';

export interface MetadataSuggestions {
  authors: string[];
  artists: string[];
  genres: string[];
  magazines: string[];
  translationGroups: string[];
}

interface Props {
  filters: MangaFilters;
  appliedFilters: MangaFilters;
  suggestions: MetadataSuggestions;
  onChange: (key: keyof MangaFilters, value: string) => void;
  onApply: () => void;
  onApplyFilters: (filters: MangaFilters) => void;
  onSortChange: (sortBy: MangaSortKey, direction: SortDirection) => void;
  onClearDraft: () => void;
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
}

const sortOptions: Array<[MangaSortKey, SortDirection, MessageKey]> = [
  ['lastUpdate', 'desc', 'sortRecentlyUpdated'],
  ['views', 'desc', 'sortPopular'],
  ['lastChapter', 'desc', 'sortNewestChapter'],
];

const chapterLengthOptions: Array<[ChapterLengthTier, MessageKey, MessageKey?]> = [
  ['any', 'allValues'],
  ['common', 'chapterTierCommon', 'chapterRangeCommon'],
  ['uncommon', 'chapterTierUncommon', 'chapterRangeUncommon'],
  ['rare', 'chapterTierRare', 'chapterRangeRare'],
  ['epic', 'chapterTierEpic', 'chapterRangeEpic'],
  ['legendary', 'chapterTierLegendary', 'chapterRangeLegendary'],
];

export function AdvancedSearch({
  filters,
  appliedFilters,
  suggestions,
  onChange,
  onApply,
  onApplyFilters,
  onSortChange,
  onClearDraft,
  t,
}: Props) {
  const appliedChips = createAppliedChips(appliedFilters, t);
  const selectedSort = `${appliedFilters.sortBy}:${appliedFilters.direction}`;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onApply();
  };

  return (
    <section className="advanced-search" data-testid="advanced-search">
      <div className="search-filter-toolbar">
        <details className="filter-drawer">
          <summary>
            <span>{t('advancedSearch')}</span>
            {appliedChips.length > 0 && <span className="filter-count">{appliedChips.length}</span>}
          </summary>
          <form onSubmit={submit}>
            <fieldset>
              <legend>{t('genresLabel')}</legend>
              <FilterInput
                label={t('genresLabel')}
                value={filters.genres}
                field="genres"
                list="genres-list"
                placeholder={t('commaSeparated')}
                onChange={onChange}
              />
              {suggestions.genres.length > 0 && (
                <div className="filter-options" aria-label={t('popularGenres')}>
                  {suggestions.genres.slice(0, 8).map((genre) => {
                    const selected = includesListValue(filters.genres, genre);
                    return (
                      <button
                        type="button"
                        className={selected ? 'active' : ''}
                        aria-pressed={selected}
                        key={genre}
                        onClick={() => onChange('genres', toggleListValue(filters.genres, genre))}
                      >
                        {genre}
                      </button>
                    );
                  })}
                </div>
              )}
            </fieldset>

            <fieldset>
              <legend>{t('chapterLength')}</legend>
              <div className="filter-options chapter-tier-options">
                {chapterLengthOptions.map(([tier, label, range]) => (
                  <label className="filter-radio chapter-tier" key={tier}>
                    <input
                      type="radio"
                      name="chapter-length"
                      value={tier}
                      checked={filters.chapterLength === tier}
                      onChange={(event) => onChange('chapterLength', event.target.value)}
                    />
                    <span>
                      <strong>{t(label)}</strong>
                      {range && <small>{t(range)}</small>}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="filter-actions">
              <button type="button" onClick={onClearDraft} data-testid="reset-filters">
                {t('clearFilters')}
              </button>
              <button type="submit" className="apply-filters" data-testid="apply-filters">
                {t('applyFilters')}
              </button>
            </div>
          </form>
        </details>

        <label className="sort-control">
          <span>{t('sortBy')}</span>
          <select
            data-testid="search-sort"
            value={selectedSort}
            onChange={(event) => {
              const option = sortOptions.find(
                ([sortBy, direction]) => `${sortBy}:${direction}` === event.target.value,
              );
              if (option) onSortChange(option[0], option[1]);
            }}
          >
            {sortOptions.map(([sortBy, direction, label]) => (
              <option value={`${sortBy}:${direction}`} key={`${sortBy}:${direction}`}>
                {t(label)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {appliedChips.length > 0 && (
        <div className="applied-filters" aria-label={t('appliedFilters')}>
          {appliedChips.map((chip) => (
            <button
              type="button"
              key={chip.id}
              onClick={() => onApplyFilters(chip.remove(appliedFilters))}
              aria-label={t('removeFilter', { value: chip.label })}
            >
              <span>{chip.label}</span>
              <span aria-hidden="true">×</span>
            </button>
          ))}
          <button
            type="button"
            className="clear-applied-filters"
            onClick={() => onApplyFilters(clearVisibleFilters(appliedFilters))}
          >
            {t('clearFilters')}
          </button>
        </div>
      )}

      <SuggestionList id="genres-list" values={suggestions.genres} />
    </section>
  );
}

interface AppliedChip {
  id: string;
  label: string;
  remove: (filters: MangaFilters) => MangaFilters;
}

function createAppliedChips(
  filters: MangaFilters,
  t: (key: MessageKey, values?: Record<string, string | number>) => string,
): AppliedChip[] {
  const chips: AppliedChip[] = splitList(filters.genres).map((genre) => ({
    id: `genre-${genre}`,
    label: genre,
    remove: (current) => ({ ...current, genres: removeListValue(current.genres, genre) }),
  }));

  if (filters.chapterLength !== 'any') {
    const option = chapterLengthOptions.find(([tier]) => tier === filters.chapterLength);
    if (option) {
      chips.push({
        id: 'chapter-length',
        label: `${t('chapterLength')}: ${t(option[1])}`,
        remove: (current) => ({ ...current, chapterLength: 'any' }),
      });
    }
  }

  return chips;
}

function clearVisibleFilters(filters: MangaFilters): MangaFilters {
  return {
    ...filters,
    genres: '',
    chapterLength: 'any',
  };
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function includesListValue(current: string, value: string): boolean {
  const normalized = value.toLocaleLowerCase();
  return splitList(current).some((item) => item.toLocaleLowerCase() === normalized);
}

function toggleListValue(current: string, value: string): string {
  const values = splitList(current);
  const normalized = value.toLocaleLowerCase();
  const next = values.some((item) => item.toLocaleLowerCase() === normalized)
    ? values.filter((item) => item.toLocaleLowerCase() !== normalized)
    : [...values, value];
  return next.join(', ');
}

function removeListValue(current: string, value: string): string {
  const normalized = value.toLocaleLowerCase();
  return splitList(current)
    .filter((item) => item.toLocaleLowerCase() !== normalized)
    .join(', ');
}

function FilterInput({
  label,
  field,
  value,
  onChange,
  list,
  placeholder,
}: {
  label: string;
  field: keyof MangaFilters;
  value: string;
  onChange: (key: keyof MangaFilters, value: string) => void;
  list?: string;
  placeholder?: string;
}) {
  return (
    <label className="filter-field">
      <span>{label}</span>
      <input
        data-filter-field={field}
        value={value}
        list={list}
        placeholder={placeholder}
        onChange={(event) => onChange(field, event.target.value)}
      />
    </label>
  );
}

function SuggestionList({ id, values }: { id: string; values: string[] }) {
  return (
    <datalist id={id}>
      {values.map((value) => (
        <option value={value} key={value} />
      ))}
    </datalist>
  );
}
