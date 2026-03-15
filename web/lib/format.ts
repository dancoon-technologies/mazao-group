/**
 * Formatting utilities (single responsibility, reusable).
 */

export function formatDate(isoDateString: string): string {
  return new Date(isoDateString).toLocaleDateString();
}

export function formatDateTime(isoDateString: string): string {
  return new Date(isoDateString).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function pluralize(
  count: number,
  singular: string,
  plural?: string
): string {
  const word = count === 1 ? singular : plural ?? `${singular}s`;
  return `${count} ${word}`;
}

/** Humanize activity_type (e.g. farm_to_farm_visits → Farm to farm visits). */
export function formatActivityType(value: string): string {
  if (!value) return "—";
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Format multiple activity types for display (e.g. "Farm to farm visits, Group training"). */
export function formatActivityTypes(types: string[] | undefined | null): string {
  if (!types?.length) return "—";
  return types.map(formatActivityType).join(", ");
}

/** Format duration in seconds as e.g. "5 min", "1 h 12 min". Returns "—" for null or negative. */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds < 0 || !Number.isFinite(seconds)) return "—";
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

/**
 * Format latitude/longitude for display. Handles string or number from API; returns "—" for null/undefined/NaN.
 */
export function formatLatLng(lat: unknown, lng: unknown, decimals = 5): string {
  const fmt = (n: unknown) => {
    if (n == null) return null;
    const num = Number(n);
    return Number.isNaN(num) ? null : num.toFixed(decimals);
  };
  const a = fmt(lat);
  const b = fmt(lng);
  if (a != null && b != null) return `${a}, ${b}`;
  return "—";
}
