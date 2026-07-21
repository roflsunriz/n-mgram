import type { FormEvent, ReactNode } from 'react';
import type { MessageKey } from '../i18n';
import {
  createDefaultMangaFilters,
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
  suggestions: MetadataSuggestions;
  onChange: (key: keyof MangaFilters, value: string) => void;
  onApply: () => void;
  onQuickApply: (overrides: Partial<MangaFilters>) => void;
  onReset: () => void;
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
}

const sortOptions: Array<[MangaSortKey, MessageKey]> = [
  ['relevance', 'sortRelevance'],
  ['id', 'mangaId'],
  ['name', 'titleLabel'],
  ['otherName', 'alternativeTitle'],
  ['slug', 'slugLabel'],
  ['authors', 'authorLabel'],
  ['artists', 'artistLabel'],
  ['genres', 'genresLabel'],
  ['magazines', 'magazineLabel'],
  ['transGroup', 'translationGroup'],
  ['description', 'descriptionLabel'],
  ['released', 'releasedLabel'],
  ['mStatus', 'statusLabel'],
  ['views', 'viewsLabel'],
  ['lastUpdate', 'updatedDate'],
  ['post', 'postedDate'],
  ['lastChapter', 'latestChapter'],
  ['submitter', 'submitterId'],
  ['groupUploader', 'uploaderId'],
  ['hidden', 'visibility'],
  ['cover', 'coverUrl'],
];

const quickSortOptions: Array<[MangaSortKey, SortDirection, MessageKey]> = [
  ['relevance', 'asc', 'sortRelevance'],
  ['views', 'desc', 'popular'],
  ['lastUpdate', 'desc', 'updated'],
  ['lastChapter', 'desc', 'latestChapter'],
];

const commonFilterKeys = new Set<keyof MangaFilters>([
  'keyword',
  'genres',
  'status',
  'sortBy',
  'direction',
]);

export function AdvancedSearch({
  filters,
  suggestions,
  onChange,
  onApply,
  onQuickApply,
  onReset,
  t,
}: Props) {
  const advancedActiveCount = countAdvancedFilters(filters);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onApply();
  };

  return (
    <section className="advanced-search" data-testid="advanced-search">
      <form onSubmit={submit}>
        <div className="common-search-controls" data-testid="common-search-controls">
          <div className="common-filter-grid">
            <FilterInput
              label={t('genresLabel')}
              value={filters.genres}
              field="genres"
              list="genres-list"
              placeholder={t('commaSeparated')}
              onChange={onChange}
            />
            <label className="filter-field">
              <span>{t('statusLabel')}</span>
              <select
                data-filter-field="status"
                value={filters.status}
                onChange={(event) => onChange('status', event.target.value)}
              >
                <option value="any">{t('allValues')}</option>
                <option value="ongoing">{t('ongoing')}</option>
                <option value="completed">{t('completed')}</option>
              </select>
            </label>
            <label className="filter-field">
              <span>{t('sortBy')}</span>
              <select
                data-filter-field="sortBy"
                value={filters.sortBy}
                onChange={(event) => onChange('sortBy', event.target.value)}
              >
                {sortOptions.map(([value, label]) => (
                  <option value={value} key={value}>
                    {t(label)}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-field">
              <span>{t('direction')}</span>
              <select
                data-filter-field="direction"
                value={filters.direction}
                onChange={(event) => onChange('direction', event.target.value)}
              >
                <option value="asc">{t('ascending')}</option>
                <option value="desc">{t('descending')}</option>
              </select>
            </label>
          </div>

          {suggestions.genres.length > 0 && (
            <QuickFilterRow label={t('popularGenres')}>
              {suggestions.genres.slice(0, 8).map((genre) => {
                const selected = includesListValue(filters.genres, genre);
                return (
                  <button
                    type="button"
                    className={selected ? 'active' : ''}
                    aria-pressed={selected}
                    key={genre}
                    onClick={() => onQuickApply({ genres: toggleListValue(filters.genres, genre) })}
                  >
                    {genre}
                  </button>
                );
              })}
            </QuickFilterRow>
          )}

          <QuickFilterRow label={t('quickStatus')}>
            {(['any', 'ongoing', 'completed'] as const).map((status) => (
              <button
                type="button"
                className={filters.status === status ? 'active' : ''}
                aria-pressed={filters.status === status}
                key={status}
                onClick={() => onQuickApply({ status })}
              >
                {t(status === 'any' ? 'allValues' : status)}
              </button>
            ))}
          </QuickFilterRow>

          <QuickFilterRow label={t('quickSort')}>
            {quickSortOptions.map(([sortBy, direction, label]) => {
              const selected = filters.sortBy === sortBy && filters.direction === direction;
              return (
                <button
                  type="button"
                  className={selected ? 'active' : ''}
                  aria-pressed={selected}
                  key={`${sortBy}-${direction}`}
                  onClick={() => onQuickApply({ sortBy, direction })}
                >
                  {t(label)}
                </button>
              );
            })}
          </QuickFilterRow>
          <p className="quick-filter-hint">{t('quickApplyHint')}</p>
        </div>

        <details className="advanced-search-details">
          <summary>
            <span>{t('advancedSearch')}</span>
            {advancedActiveCount > 0 && <span className="filter-count">{advancedActiveCount}</span>}
          </summary>
          <div className="advanced-search-content">
            <p className="filter-hint">{t('filterHint')}</p>
            <fieldset>
              <legend>{t('textMetadata')}</legend>
              <div className="filter-grid">
                <FilterInput
                  label={t('titleLabel')}
                  value={filters.title}
                  field="title"
                  onChange={onChange}
                />
                <FilterInput
                  label={t('alternativeTitle')}
                  value={filters.otherName}
                  field="otherName"
                  onChange={onChange}
                />
                <FilterInput
                  label={t('slugLabel')}
                  value={filters.slug}
                  field="slug"
                  onChange={onChange}
                />
                <FilterInput
                  label={t('authorLabel')}
                  value={filters.author}
                  field="author"
                  list="authors-list"
                  onChange={onChange}
                />
                <FilterInput
                  label={t('artistLabel')}
                  value={filters.artist}
                  field="artist"
                  list="artists-list"
                  onChange={onChange}
                />
                <FilterInput
                  label={t('magazineLabel')}
                  value={filters.magazine}
                  field="magazine"
                  list="magazines-list"
                  onChange={onChange}
                />
                <FilterInput
                  label={t('translationGroup')}
                  value={filters.translationGroup}
                  field="translationGroup"
                  list="translation-groups-list"
                  onChange={onChange}
                />
                <FilterInput
                  label={t('descriptionLabel')}
                  value={filters.description}
                  field="description"
                  onChange={onChange}
                />
                <FilterInput
                  label={t('coverUrl')}
                  value={filters.cover}
                  field="cover"
                  onChange={onChange}
                />
              </div>
            </fieldset>

            <fieldset>
              <legend>{t('numericMetadata')}</legend>
              <div className="filter-grid">
                <FilterInput
                  label={t('mangaId')}
                  value={filters.mangaId}
                  field="mangaId"
                  type="number"
                  min="1"
                  onChange={onChange}
                />
                <RangeInputs
                  label={t('releasedLabel')}
                  from={filters.releasedFrom}
                  to={filters.releasedTo}
                  fromField="releasedFrom"
                  toField="releasedTo"
                  onChange={onChange}
                  t={t}
                />
                <RangeInputs
                  label={t('viewsLabel')}
                  from={filters.viewsFrom}
                  to={filters.viewsTo}
                  fromField="viewsFrom"
                  toField="viewsTo"
                  onChange={onChange}
                  t={t}
                />
                <RangeInputs
                  label={t('latestChapter')}
                  from={filters.chapterFrom}
                  to={filters.chapterTo}
                  fromField="chapterFrom"
                  toField="chapterTo"
                  step="0.1"
                  onChange={onChange}
                  t={t}
                />
                <FilterInput
                  label={t('submitterId')}
                  value={filters.submitter}
                  field="submitter"
                  type="number"
                  min="0"
                  onChange={onChange}
                />
                <FilterInput
                  label={t('uploaderId')}
                  value={filters.groupUploader}
                  field="groupUploader"
                  type="number"
                  min="0"
                  onChange={onChange}
                />
              </div>
            </fieldset>

            <fieldset>
              <legend>{t('datesAndState')}</legend>
              <div className="filter-grid">
                <RangeInputs
                  label={t('postedDate')}
                  from={filters.postedFrom}
                  to={filters.postedTo}
                  fromField="postedFrom"
                  toField="postedTo"
                  type="date"
                  onChange={onChange}
                  t={t}
                />
                <RangeInputs
                  label={t('updatedDate')}
                  from={filters.updatedFrom}
                  to={filters.updatedTo}
                  fromField="updatedFrom"
                  toField="updatedTo"
                  type="date"
                  onChange={onChange}
                  t={t}
                />
                <label className="filter-field">
                  <span>{t('visibility')}</span>
                  <select
                    data-filter-field="hidden"
                    value={filters.hidden}
                    onChange={(event) => onChange('hidden', event.target.value)}
                  >
                    <option value="visible">{t('visibleOnly')}</option>
                    <option value="hidden">{t('hiddenOnly')}</option>
                    <option value="any">{t('allValues')}</option>
                  </select>
                </label>
              </div>
            </fieldset>
          </div>
        </details>

        <div className="filter-actions">
          <button type="button" onClick={onReset} data-testid="reset-filters">
            {t('clearFilters')}
          </button>
          <button type="submit" className="apply-filters" data-testid="apply-filters">
            {t('applyFilters')}
          </button>
        </div>
        <SuggestionList id="authors-list" values={suggestions.authors} />
        <SuggestionList id="artists-list" values={suggestions.artists} />
        <SuggestionList id="genres-list" values={suggestions.genres} />
        <SuggestionList id="magazines-list" values={suggestions.magazines} />
        <SuggestionList id="translation-groups-list" values={suggestions.translationGroups} />
      </form>
    </section>
  );
}

function QuickFilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="quick-filter-row">
      <span>{label}</span>
      <div>{children}</div>
    </div>
  );
}

function countAdvancedFilters(filters: MangaFilters): number {
  const defaults = createDefaultMangaFilters();
  return (Object.keys(defaults) as Array<keyof MangaFilters>).filter(
    (key) => !commonFilterKeys.has(key) && filters[key] !== defaults[key],
  ).length;
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

function FilterInput({
  label,
  field,
  value,
  onChange,
  type = 'text',
  list,
  placeholder,
  min,
}: {
  label: string;
  field: keyof MangaFilters;
  value: string;
  onChange: (key: keyof MangaFilters, value: string) => void;
  type?: 'text' | 'number';
  list?: string;
  placeholder?: string;
  min?: string;
}) {
  return (
    <label className="filter-field">
      <span>{label}</span>
      <input
        data-filter-field={field}
        type={type}
        value={value}
        list={list}
        placeholder={placeholder}
        min={min}
        onChange={(event) => onChange(field, event.target.value)}
      />
    </label>
  );
}

function RangeInputs({
  label,
  from,
  to,
  fromField,
  toField,
  onChange,
  t,
  type = 'number',
  step,
}: {
  label: string;
  from: string;
  to: string;
  fromField: keyof MangaFilters;
  toField: keyof MangaFilters;
  onChange: (key: keyof MangaFilters, value: string) => void;
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
  type?: 'number' | 'date';
  step?: string;
}) {
  return (
    <div className="filter-field range-field">
      <span>{label}</span>
      <div>
        <input
          data-filter-field={fromField}
          type={type}
          value={from}
          placeholder={t('from')}
          min={type === 'number' ? '0' : undefined}
          step={step}
          onChange={(event) => onChange(fromField, event.target.value)}
          aria-label={`${label} ${t('from')}`}
        />
        <span>–</span>
        <input
          data-filter-field={toField}
          type={type}
          value={to}
          placeholder={t('to')}
          min={type === 'number' ? '0' : undefined}
          step={step}
          onChange={(event) => onChange(toField, event.target.value)}
          aria-label={`${label} ${t('to')}`}
        />
      </div>
    </div>
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
