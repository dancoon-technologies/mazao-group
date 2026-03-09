/**
 * Caps for persisted lists to avoid AsyncStorage bloat.
 * Oldest items (by date) are dropped when over cap.
 */
export const MAX_VISITS = 2000;
export const MAX_SCHEDULES = 2000;
