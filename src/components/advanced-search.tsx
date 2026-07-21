import type { FormEvent } from 'react';
import type { MessageKey } from '../i18n';
import { countActiveFilters, type MangaFilters, type MangaSortKey } from '../search/manga-search';

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

export function AdvancedSearch({ filters, suggestions, onChange, onApply, onReset, t }: Props) {
  const activeCount = countActiveFilters(filters);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onApply();
  };

  return (
    <details className="advanced-search" data-testid="advanced-search">
      <summary>
        <span>{t('advancedSearch')}</span>
        {activeCount > 0 && <span className="filter-count">{activeCount}</span>}
      </summary>
      <form onSubmit={submit}>
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
              label={t('genresLabel')}
              value={filters.genres}
              field="genres"
              list="genres-list"
              placeholder={t('commaSeparated')}
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

        <fieldset>
          <legend>{t('sort')}</legend>
          <div className="filter-grid sort-filter-grid">
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
        </fieldset>

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
    </details>
  );
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
