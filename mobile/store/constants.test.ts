/**
 * Tests for store caps/constants.
 */

import { MAX_VISITS, MAX_SCHEDULES } from '@/store/constants';

describe('store constants', () => {
  it('MAX_VISITS is a positive number', () => {
    expect(typeof MAX_VISITS).toBe('number');
    expect(MAX_VISITS).toBeGreaterThan(0);
  });

  it('MAX_SCHEDULES is a positive number', () => {
    expect(typeof MAX_SCHEDULES).toBe('number');
    expect(MAX_SCHEDULES).toBeGreaterThan(0);
  });
});
