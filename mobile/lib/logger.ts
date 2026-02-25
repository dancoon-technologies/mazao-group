/**
 * Simple logger for the mobile app. Use __DEV__ or a flag to reduce verbosity in production.
 * Avoid logging secrets or full PII; log IDs and high-level events only where needed.
 */

const isDev = __DEV__;

export const logger = {
  debug(message: string, ...args: unknown[]) {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  },

  info(message: string, ...args: unknown[]) {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.info(`[INFO] ${message}`, ...args);
    }
  },

  warn(message: string, ...args: unknown[]) {
    // eslint-disable-next-line no-console
    console.warn(`[WARN] ${message}`, ...args);
  },

  error(message: string, ...args: unknown[]) {
    // eslint-disable-next-line no-console
    console.error(`[ERROR] ${message}`, ...args);
  },
};
