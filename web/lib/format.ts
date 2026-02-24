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
