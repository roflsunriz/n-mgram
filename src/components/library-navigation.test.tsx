// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../i18n';
import { LibraryNavigation } from './library-navigation';

afterEach(cleanup);

describe('LibraryNavigation', () => {
  it('provides four independent pages and their counts', () => {
    const onNavigate = vi.fn();
    render(
      <LibraryNavigation
        activePage="discover"
        historyCount={3}
        updateCount={2}
        onNavigate={onNavigate}
        t={createTranslator('ja')}
      />,
    );

    expect(screen.getAllByRole('button')).toHaveLength(4);
    expect(screen.getByTestId('library-tab-discover').getAttribute('aria-current')).toBe('page');
    expect(screen.getByTestId('library-tab-history').textContent).toContain('ライブラリ');
    expect(screen.getByTestId('library-tab-history').textContent).toContain('3');
    expect(screen.getByTestId('library-tab-updates').textContent).toContain('2');
    fireEvent.click(screen.getByTestId('library-tab-search'));
    expect(onNavigate).toHaveBeenCalledWith('search');
  });
});
