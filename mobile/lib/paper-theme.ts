import { MD3LightTheme } from 'react-native-paper';

/**
 * Mazao Field App — React Native Paper theme (MD3).
 */
export const paperTheme = {
  ...MD3LightTheme,
  roundness: 6,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#1B8F3A',
    primaryContainer: '#E6F4EA',
    secondary: '#F59E0B',
    secondaryContainer: '#FEF3C7',
    error: '#EF4444',
    errorContainer: '#FEE2E2',
    background: '#F9FAFB',
    surface: '#FFFFFF',
    surfaceVariant: '#F3F4F6',
    outline: '#E5E7EB',
    outlineVariant: '#E5E7EB',
  },
};

export type AppTheme = typeof paperTheme;
