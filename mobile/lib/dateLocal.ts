/**
 * Local calendar dates (YYYY-MM-DD) without UTC drift from Date#toISOString().
 * Used for weekly routes, schedules, and "today" comparisons.
 */

export function toLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Monday (local) of the week containing `d`. */
export function getMondayOfLocalWeek(d: Date = new Date()): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay();
  const diff = (day + 6) % 7;
  date.setDate(date.getDate() - diff);
  return date;
}

export function localWeekStartYmd(d: Date = new Date()): string {
  return toLocalYmd(getMondayOfLocalWeek(d));
}

/** Mon–Sat (6 days) starting at Monday `weekStartYmd`. */
export function localWeekMonToSat(weekStartYmd: string): string[] {
  const [y, m, d] = weekStartYmd.split('-').map(Number);
  if (!y || !m || !d) return [];
  const start = new Date(y, m - 1, d);
  const out: string[] = [];
  for (let i = 0; i < 6; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    out.push(toLocalYmd(day));
  }
  return out;
}
