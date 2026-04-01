import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
const sentryEnabled = Boolean(dsn);

if (sentryEnabled) {
  Sentry.init({
    dsn,
    enabled: true,
    debug: false,
    tracesSampleRate: __DEV__ ? 0 : 0.1,
    environment: __DEV__ ? 'development' : 'production',
    release: `${Constants.expoConfig?.slug ?? 'mazao-group'}@${Constants.expoConfig?.version ?? '0.0.0'}`,
  });
}

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

export function captureWarning(message: string, ...args: unknown[]) {
  if (!sentryEnabled) return;
  Sentry.withScope((scope) => {
    if (args.length > 0) {
      scope.setContext('logger_warning', { args: toSerializable(args) });
    }
    Sentry.captureMessage(message, 'warning');
  });
}

export function captureError(message: string, ...args: unknown[]) {
  if (!sentryEnabled) return;
  const firstError = args.find((a) => a instanceof Error) as Error | undefined;
  Sentry.withScope((scope) => {
    if (args.length > 0) {
      scope.setContext('logger_error', { args: toSerializable(args) });
    }
    if (firstError) {
      Sentry.captureException(firstError);
    } else {
      Sentry.captureMessage(message, 'error');
    }
  });
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (!sentryEnabled) return;
  Sentry.withScope((scope) => {
    if (context) scope.setContext('app_context', toSerializable(context) as Record<string, unknown>);
    if (error instanceof Error) Sentry.captureException(error);
    else Sentry.captureMessage(String(error), 'error');
  });
}

export function setSentryUser(user: { id?: string | null; email?: string | null; role?: string | null } | null) {
  if (!sentryEnabled) return;
  if (!user) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({
    ...(user.id ? { id: user.id } : {}),
    ...(user.email ? { email: user.email } : {}),
    ...(user.role ? { role: user.role } : {}),
  });
}

export { Sentry };
