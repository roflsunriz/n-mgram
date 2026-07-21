// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../i18n';
import type { ReadingProgress } from '../storage/library-store';
import { ChapterUpdatesPanel, ReadingHistoryPanel } from './reading-dashboard';

const history: ReadingProgress[] = [
  {
    mangaId: 7,
    title: '読んだ作品',
    cover: 'https://ihlv1.xyz/cover.webp',
    chapter: 3,
    page: 4,
    pageCount: 10,
    latestChapter: 5,
    updatedAt: '2026-07-21T12:00:00.000Z',
  },
];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('reading pages', () => {
  it('shows real history title, chapter, progress, and read date', () => {
    render(
      <ReadingHistoryPanel
        history={history}
        locale="ja"
        restoringMetadata={false}
        metadataFailures={0}
        onOpen={vi.fn()}
        onDelete={vi.fn()}
        onClear={vi.fn()}
        onRetryMetadata={vi.fn()}
        t={createTranslator('ja')}
      />,
    );
    expect(screen.getByText('読んだ作品')).toBeTruthy();
    expect(screen.getByText('第3話 · 50% 読了')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('50');
    expect(screen.getByText(/最終閲覧/)).toBeTruthy();
  });

  it('never renders a fake entry while migrated metadata is restored', () => {
    render(
      <ReadingHistoryPanel
        history={[{ ...history[0]!, title: '', cover: '' }]}
        locale="ja"
        restoringMetadata
        metadataFailures={0}
        onOpen={vi.fn()}
        onDelete={vi.fn()}
        onClear={vi.fn()}
        onRetryMetadata={vi.fn()}
        t={createTranslator('ja')}
      />,
    );
    expect(screen.getByRole('status').textContent).toContain('履歴情報を復元中');
    expect(screen.queryByTestId('history-open-7')).toBeNull();
    expect(screen.queryByText('作品 #7')).toBeNull();
  });

  it('allows retrying failed metadata restoration', () => {
    const onRetryMetadata = vi.fn();
    render(
      <ReadingHistoryPanel
        history={[{ ...history[0]!, title: '', cover: '' }]}
        locale="ja"
        restoringMetadata={false}
        metadataFailures={1}
        onOpen={vi.fn()}
        onDelete={vi.fn()}
        onClear={vi.fn()}
        onRetryMetadata={onRetryMetadata}
        t={createTranslator('ja')}
      />,
    );
    fireEvent.click(screen.getByText('復元を再試行'));
    expect(onRetryMetadata).toHaveBeenCalledOnce();
  });

  it('opens and deletes history after confirmation', () => {
    const onOpen = vi.fn();
    const onDelete = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(
      <ReadingHistoryPanel
        history={history}
        locale="ja"
        restoringMetadata={false}
        metadataFailures={0}
        onOpen={onOpen}
        onDelete={onDelete}
        onClear={vi.fn()}
        onRetryMetadata={vi.fn()}
        t={createTranslator('ja')}
      />,
    );
    fireEvent.click(screen.getByTestId('history-open-7'));
    fireEvent.click(screen.getByTestId('history-delete-7'));
    expect(onOpen).toHaveBeenCalledWith(history[0]);
    expect(onDelete).toHaveBeenCalledWith(7);
  });

  it('clears all history after confirmation', () => {
    const onClear = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(
      <ReadingHistoryPanel
        history={history}
        locale="ja"
        restoringMetadata={false}
        metadataFailures={0}
        onOpen={vi.fn()}
        onDelete={vi.fn()}
        onClear={onClear}
        onRetryMetadata={vi.fn()}
        t={createTranslator('ja')}
      />,
    );
    fireEvent.click(screen.getByTestId('clear-history'));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('shows and opens available chapter updates', () => {
    const onOpen = vi.fn();
    const onCheckUpdates = vi.fn();
    render(
      <ChapterUpdatesPanel
        history={history}
        locale="ja"
        checkingUpdates={false}
        updateCheckFailures={0}
        onOpen={onOpen}
        onCheckUpdates={onCheckUpdates}
        t={createTranslator('ja')}
      />,
    );
    expect(screen.getByTestId('notification-open-7').textContent).toContain(
      '第5話まで更新（閲覧は第3話）',
    );
    fireEvent.click(screen.getByTestId('notification-open-7'));
    fireEvent.click(screen.getByTestId('check-history-updates'));
    expect(onOpen).toHaveBeenCalledWith(history[0]);
    expect(onCheckUpdates).toHaveBeenCalledOnce();
  });
});
