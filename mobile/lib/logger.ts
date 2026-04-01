import { captureError, captureWarning } from '@/lib/sentry';

/**
 * Simple logger for the mobile app. Use __DEV__ or a flag to reduce verbosity in production.
 * Avoid logging secrets or full PII; log IDs and high-level events only where needed.
 */

const isDev = __DEV__;
let globalContext: Record<string, unknown> = {};

function toSerializable(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
}

function mergeContext(eventContext?: Record<string, unknown>): Record<string, unknown> {
  return {
    ...globalContext,
    ...(eventContext ?? {}),
  };
}

function splitContextAndArgs(
  maybeContext: unknown,
  args: unknown[]
): { context: Record<string, unknown>; extra: unknown[] } {
  if (
    maybeContext != null &&
    typeof maybeContext === 'object' &&
    !Array.isArray(maybeContext) &&
    !(maybeContext instanceof Error)
  ) {
    return { context: mergeContext(maybeContext as Record<string, unknown>), extra: args };
  }
  return { context: mergeContext(undefined), extra: [maybeContext, ...args] };
}

function formatPrefix(level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR', message: string): string {
  return `[${level}] ${message}`;
}

export const logger = {
  setContext(context: Record<string, unknown>) {
    globalContext = mergeContext(context);
  },

  clearContext() {
    globalContext = {};
  },

  debug(message: string, maybeContext?: unknown, ...args: unknown[]) {
    const { context: ctx, extra } = splitContextAndArgs(maybeContext, args);
    if (isDev) {
      // eslint-disable-next-line no-console
      console.debug(formatPrefix('DEBUG', message), ctx, ...extra.map(toSerializable));
    }
  },

  info(message: string, maybeContext?: unknown, ...args: unknown[]) {
    const { context: ctx, extra } = splitContextAndArgs(maybeContext, args);
    if (isDev) {
      // eslint-disable-next-line no-console
      console.info(formatPrefix('INFO', message), ctx, ...extra.map(toSerializable));
    }
  },

  warn(message: string, maybeContext?: unknown, ...args: unknown[]) {
    const { context: ctx, extra } = splitContextAndArgs(maybeContext, args);
    // eslint-disable-next-line no-console
    console.warn(formatPrefix('WARN', message), ctx, ...extra.map(toSerializable));
    captureWarning(message, ctx, ...extra);
  },

  error(message: string, maybeContext?: unknown, ...args: unknown[]) {
    const { context: ctx, extra } = splitContextAndArgs(maybeContext, args);
    // eslint-disable-next-line no-console
    console.error(formatPrefix('ERROR', message), ctx, ...extra.map(toSerializable));
    captureError(message, ctx, ...extra);
  },
};
