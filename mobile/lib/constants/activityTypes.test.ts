/**
 * Tests for activity types constants.
 */

import { ACTIVITY_TYPES, DEFAULT_ACTIVITY_TYPE } from '@/lib/constants/activityTypes';

describe('ACTIVITY_TYPES', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(ACTIVITY_TYPES)).toBe(true);
    expect(ACTIVITY_TYPES.length).toBeGreaterThan(0);
  });

  it('each entry has value and label', () => {
    ACTIVITY_TYPES.forEach((entry) => {
      expect(entry).toHaveProperty('value');
      expect(entry).toHaveProperty('label');
      expect(typeof entry.value).toBe('string');
      expect(typeof entry.label).toBe('string');
    });
  });

  it('includes farm_to_farm_visits', () => {
    const found = ACTIVITY_TYPES.find((e) => e.value === 'farm_to_farm_visits');
    expect(found).toBeDefined();
    expect(found!.label).toBe('Farm to farm visits');
  });

  it('has unique values', () => {
    const values = ACTIVITY_TYPES.map((e) => e.value);
    const set = new Set(values);
    expect(set.size).toBe(values.length);
  });
});

describe('DEFAULT_ACTIVITY_TYPE', () => {
  it('equals farm_to_farm_visits', () => {
    expect(DEFAULT_ACTIVITY_TYPE).toBe('farm_to_farm_visits');
  });

  it('exists in ACTIVITY_TYPES', () => {
    expect(ACTIVITY_TYPES.some((e) => e.value === DEFAULT_ACTIVITY_TYPE)).toBe(true);
  });
});
