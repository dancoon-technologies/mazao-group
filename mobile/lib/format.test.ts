/**
 * Tests for lib/format (date and status formatting).
 */

import {
  formatDate,
  formatDateHeader,
  formatDateShort,
  formatDateTime,
  visitStatusLabel,
  visitStatusColor,
  scheduleStatusLabel,
  scheduleStatusColor,
  isScheduleEditableByDate,
  type ScheduleStatus,
} from '@/lib/format';

describe('formatDate', () => {
  it('formats ISO date string (weekday and date parts; locale may reorder day/month)', () => {
    const out = formatDate('2025-03-15T12:00:00.000Z');
    // e.g. "Sat, 15 Mar" or "Sat, Mar 15"
    expect(out).toMatch(/\w{3}, (\d{1,2} \w{3}|\w{3} \d{1,2})/);
  });

  it('returns Invalid Date string for unparseable input', () => {
    expect(formatDate('not-a-date')).toBe('Invalid Date');
  });
});

describe('formatDateHeader', () => {
  it('formats with weekday, date parts, and year (locale may reorder day/month)', () => {
    const out = formatDateHeader('2025-03-15T12:00:00.000Z');
    // e.g. "Sat, 15 March 2025" or "Sat, March 15, 2025"
    expect(out).toMatch(/\w{3}, .+ \d{4}/);
    expect(out).toContain('2025');
  });
  it('returns Invalid Date for unparseable input', () => {
    expect(formatDateHeader('not-a-date')).toBe('Invalid Date');
  });
});

describe('formatDateShort', () => {
  it('formats with date and time (locale may use month/day order and 12h/24h)', () => {
    const out = formatDateShort('2025-03-15T14:30:00.000Z');
    expect(out).toMatch(/\d{1,2}:\d{2}/); // time present
    expect(out).toMatch(/\w{3}/); // month abbrev
    expect(out).toMatch(/\d{1,2}/); // day
  });
});

describe('formatDateTime', () => {
  it('formats with weekday, date and time (locale may reorder and use 12h/24h)', () => {
    const out = formatDateTime('2025-03-15T14:30:00.000Z');
    expect(out).toMatch(/\w{3},/); // weekday abbrev
    expect(out).toMatch(/\d{1,2}:\d{2}/); // time
    expect(out).toMatch(/\w{3}/); // month
  });
});

describe('visitStatusLabel', () => {
  it('returns Verified for verified', () => {
    expect(visitStatusLabel('verified')).toBe('Verified');
  });
  it('returns Rejected for rejected', () => {
    expect(visitStatusLabel('rejected')).toBe('Rejected');
  });
  it('returns Pending for pending or unknown', () => {
    expect(visitStatusLabel('pending')).toBe('Pending');
    expect(visitStatusLabel('')).toBe('Pending');
  });
});

describe('visitStatusColor', () => {
  it('returns primary for verified', () => {
    expect(visitStatusColor('verified')).toBe('#1B8F3A');
  });
  it('returns error for rejected', () => {
    expect(visitStatusColor('rejected')).toBe('#EF4444');
  });
  it('returns warning for pending', () => {
    expect(visitStatusColor('pending')).toBe('#F59E0B');
  });
});

describe('scheduleStatusLabel', () => {
  const cases: { status: ScheduleStatus; expected: string }[] = [
    { status: 'proposed', expected: 'Pending' },
    { status: 'accepted', expected: 'Accepted' },
    { status: 'rejected', expected: 'Rejected' },
  ];
  it.each(cases)('$status -> $expected', ({ status, expected }) => {
    expect(scheduleStatusLabel(status)).toBe(expected);
  });
});

describe('scheduleStatusColor', () => {
  it('returns primary for accepted', () => {
    expect(scheduleStatusColor('accepted')).toBe('#1B8F3A');
  });
  it('returns error for rejected', () => {
    expect(scheduleStatusColor('rejected')).toBe('#EF4444');
  });
  it('returns warning for proposed', () => {
    expect(scheduleStatusColor('proposed')).toBe('#F59E0B');
  });
});

describe('isScheduleEditableByDate', () => {
  it('returns true when scheduled date is in the future', () => {
    const today = new Date();
    const future = new Date(today);
    future.setDate(future.getDate() + 3);
    const ymd = future.toISOString().slice(0, 10);
    expect(isScheduleEditableByDate(ymd)).toBe(true);
  });

  it('returns true when scheduled date is tomorrow', () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const ymd = tomorrow.toISOString().slice(0, 10);
    expect(isScheduleEditableByDate(ymd)).toBe(true);
  });

  it('returns true when scheduled date is today', () => {
    const today = new Date();
    const ymd = today.toISOString().slice(0, 10);
    expect(isScheduleEditableByDate(ymd)).toBe(true);
  });
});
