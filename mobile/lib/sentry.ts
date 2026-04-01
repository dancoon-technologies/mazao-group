import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    enabled: true,
    debug: false,
    tracesSampleRate: __DEV__ ? 0 : 0.1,
    environment: __DEV__ ? 'development' : 'production',
    release: `${Constants.expoConfig?.slug ?? 'mazao-group'}@${Constants.expoConfig?.version ?? '0.0.0'}`,
  });
}

export { Sentry };
