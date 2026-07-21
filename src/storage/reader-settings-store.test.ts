import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadReaderSettings, saveReaderSettings } from './reader-settings-store';

describe('reader settings store', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    const storage: Storage = {
      get length() {
        return values.size;
      },
      clear: () => values.clear(),
      getItem: (key) => values.get(key) ?? null,
      key: (index) => [...values.keys()][index] ?? null,
      removeItem: (key) => values.delete(key),
      setItem: (key, value) => values.set(key, value),
    };
    vi.stubGlobal('localStorage', storage);
  });

  it('uses the default scroll and fit-width settings', () => {
    expect(loadReaderSettings()).toEqual({ version: 1, mode: 'continuous', fit: 'width' });
  });

  it('saves and restores mode and fit selections', () => {
    saveReaderSettings({ version: 1, mode: 'paged', fit: 'height' });
    expect(loadReaderSettings()).toEqual({ version: 1, mode: 'paged', fit: 'height' });
  });

  it('resets incompatible settings', () => {
    localStorage.setItem(
      'n-mgram.reader-settings',
      JSON.stringify({ version: 1, mode: 'invalid', fit: 'width' }),
    );
    expect(loadReaderSettings()).toEqual({ version: 1, mode: 'continuous', fit: 'width' });
    expect(localStorage.getItem('n-mgram.reader-settings')).toBeNull();
  });
});
