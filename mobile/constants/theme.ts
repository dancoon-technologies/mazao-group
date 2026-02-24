/**
 * Design tokens for Mazao mobile app.
 * Use these instead of hardcoded colors/spacing for consistency.
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 9999,
} as const;

export const colors = {
  primary: '#2e7d32',
  primaryLight: '#a5d6a7',
  primaryContainer: '#e8f5e9',
  error: '#b00020',
  errorContainer: '#ffdad6',
  surfaceVariant: '#f3e5f5',
  outline: 'rgba(0,0,0,0.12)',
  onSurfaceVariant: 'rgba(0,0,0,0.6)',
  success: '#2e7d32',
  warning: '#ed6c02',
} as const;

/** Minimum touch target size (accessibility) */
export const minTouchTarget = 44;
