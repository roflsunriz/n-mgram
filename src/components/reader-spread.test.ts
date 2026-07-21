import { describe, expect, it } from 'vitest';
import {
  getLastSpreadStart,
  getNextSpreadStart,
  getPreviousSpreadStart,
  getReaderSpread,
} from './reader-spread';

describe('right-bound reader spreads', () => {
  it('places the cover alone on the right', () => {
    expect(getReaderSpread(0, 8)).toEqual({ start: 0, end: 0, right: 0 });
  });

  it('places the earlier page on the right and the next page on the left', () => {
    expect(getReaderSpread(2, 8)).toEqual({ start: 1, end: 2, right: 1, left: 2 });
  });

  it('navigates by one cover or two-page spreads', () => {
    expect(getNextSpreadStart(0, 8)).toBe(1);
    expect(getNextSpreadStart(1, 8)).toBe(3);
    expect(getPreviousSpreadStart(3, 8)).toBe(1);
    expect(getPreviousSpreadStart(1, 8)).toBe(0);
  });

  it('returns the final spread start for odd and even page counts', () => {
    expect(getLastSpreadStart(8)).toBe(7);
    expect(getLastSpreadStart(9)).toBe(7);
  });
});
