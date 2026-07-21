import { describe, expect, it } from 'vitest';
import { createAppHeaders, createServerSearchRequests } from './client';

describe('app compatibility headers', () => {
  it('adds all analyzed headers to native Tauri requests', () => {
    expect(createAppHeaders(true)).toEqual({
      'User-Agent': 'Nicomanga/5.0.0/sdk/54.0.0Nicomanga',
      'x-app-sdk-version': '54.0.0',
      'x-app-version': '5.0.0',
    });
  });

  it('omits the browser-forbidden User-Agent in web preview mode', () => {
    expect(createAppHeaders(false)).toEqual({
      'x-app-sdk-version': '54.0.0',
      'x-app-version': '5.0.0',
    });
  });
});

describe('server search payloads', () => {
  const base = {
    query: '',
    name: '',
    authors: '',
    genres: [],
    magazines: '',
    status: 'Any' as const,
    page: 1,
    size: 100,
  };

  it('turns quick search into title and author requests without sending ignored query metadata', () => {
    expect(createServerSearchRequests({ ...base, query: 'slime' })).toEqual([
      { name: 'slime', authors: '', genres: [], magazines: '', status: 'Any', page: 1, size: 100 },
      { name: '', authors: 'slime', genres: [], magazines: '', status: 'Any', page: 1, size: 100 },
    ]);
  });

  it('uses one request when explicit server-side filters are present', () => {
    expect(createServerSearchRequests({ ...base, name: 'Story', genres: ['fantasy'] })).toEqual([
      {
        name: 'Story',
        authors: '',
        genres: [{ name: 'fantasy' }],
        magazines: '',
        status: 'Any',
        page: 1,
        size: 100,
      },
    ]);
  });

  it('wraps every genre in the object shape required by the API', () => {
    expect(
      createServerSearchRequests({ ...base, genres: ['psychological', 'drama'] })[0]?.genres,
    ).toEqual([{ name: 'psychological' }, { name: 'drama' }]);
  });
});
