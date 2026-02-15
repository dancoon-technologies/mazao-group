/**
 * Centralized API error parsing (DRY: one place for response/error handling).
 * @param body - Parsed JSON body from failed response (or empty object)
 * @param fallbackMessage - Message when no usable field found
 * @param fieldKeys - Optional field names to check for array error messages
 */
type ApiErrorShape = {
  detail?: string;
  [key: string]: string | string[] | undefined;
};

export function parseApiError(
  body: unknown,
  fallbackMessage: string,
  fieldKeys?: string[]
): string {
  const err = (typeof body === "object" && body !== null ? body : {}) as ApiErrorShape;
  if (typeof err.detail === "string") return err.detail;
  if (fieldKeys) {
    for (const key of fieldKeys) {
      const val = err[key];
      if (Array.isArray(val) && val[0]) return String(val[0]);
    }
  }
  return fallbackMessage;
}
