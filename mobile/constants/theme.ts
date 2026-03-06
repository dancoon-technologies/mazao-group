/**
 * Mazao Field Officer App — Design tokens (Figma-aligned).
 * 4pt grid, Inter-compatible typography, spec colors.
 */

// --- Spacing (4pt system: 4/8/12/16/20/24/32)
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  lg20: 20,
  xl: 24,
  xxl: 32,
} as const;

// --- Corner radius
export const radius = {
  sm: 4,
  md: 6,
  lg: 8,
  card: 12,
  full: 9999,
} as const;

// --- Color system (spec)
export const colors = {
  // Primary (Agriculture Green)
  primary: '#1B8F3A',
  primaryDark: '#15732E',
  primaryLight: '#E6F4EA',
  // Accent (Orange)
  accent: '#F59E0B',
  // Status
  success: '#22C55E',
  successLight: '#DCFCE7',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  info: '#3B82F6',
  // Neutrals
  gray900: '#111827',
  gray700: '#374151',
  gray500: '#6B7280',
  gray200: '#E5E7EB',
  gray100: '#F3F4F6',
  white: '#FFFFFF',
  // Legacy / aliases for existing usage
  primaryContainer: '#E6F4EA',
  onSurfaceVariant: '#6B7280',
  outline: 'rgba(0,0,0,0.12)',
  surfaceVariant: '#F3F4F6',
} as const;

// --- Typography (Inter / system)
export const typography = {
  headingXL: { fontSize: 24, fontWeight: '700' as const, lineHeight: 32 },
  headingL: { fontSize: 20, fontWeight: '600' as const, lineHeight: 28 },
  headingM: { fontSize: 18, fontWeight: '600' as const, lineHeight: 24 },
  bodyL: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  bodyM: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '500' as const, lineHeight: 16 },
  button: { fontSize: 16, fontWeight: '600' as const, lineHeight: 24 },
} as const;

// --- Card (shared look: rounded, light border, soft shadow)
export const cardStyle = {
  backgroundColor: colors.white,
  borderRadius: radius.card,
  borderWidth: 1,
  borderColor: colors.gray200,
  overflow: 'hidden' as const,
};
export const cardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.06,
  shadowRadius: 4,
  elevation: 1,
};

// --- Shadows (Card: subtle elevation)
export const shadows = {
  card: {
    ...cardShadow,
  },
  fab: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
} as const;

/** Keyboard-avoiding: extra scroll bottom padding when keyboard may open (long forms). */
export const scrollPaddingKeyboard = 120;

/** Keyboard-avoiding: scroll bottom for short auth screens (login, change-password). */
export const scrollPaddingKeyboardShort = 100;

/** Height of custom form header (e.g. "Record Visit" bar). Use as keyboardVerticalOffset when KAV is directly under it. */
export const formHeaderHeight = 52;

/** Height of Appbar.Header. Use with insets.top for keyboardVerticalOffset on screens with Appbar. */
export const appbarHeight = 56;

/** @deprecated Use formHeaderHeight or insets.top + appbarHeight per screen. */
export const keyboardAvoidOffset = 80;

/** Min touch target (accessibility) */
export const minTouchTarget = 48;

/** Button height (spec) */
export const buttonHeight = 2;

/** Input height (spec) */
export const inputHeight = 56;
