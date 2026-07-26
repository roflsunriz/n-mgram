import { describe, expect, it } from 'vitest';
import {
  getLastSpreadStart,
  getNextSpreadStart,
  getPreviousSpreadStart,
  getReaderSpread,
} from './reader-spread';

describe('right-bound reader spreads', () => {
  it('places the first two pages together from the beginning', () => {
    expect(getReaderSpread(0, 8)).toEqual({ start: 0, end: 1, right: 0, left: 1 });
  });

  it('places the earlier page on the right and the next page on the left', () => {
    expect(getReaderSpread(2, 8)).toEqual({ start: 2, end: 3, right: 2, left: 3 });
  });

  it('always navigates by two-page spreads', () => {
    expect(getNextSpreadStart(0, 8)).toBe(2);
    expect(getNextSpreadStart(1, 8)).toBe(2);
    expect(getPreviousSpreadStart(3, 8)).toBe(0);
    expect(getPreviousSpreadStart(1, 8)).toBeUndefined();
  });

  it('returns the final spread start for odd and even page counts', () => {
    expect(getLastSpreadStart(8)).toBe(6);
    expect(getLastSpreadStart(9)).toBe(8);
  });
});
