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
