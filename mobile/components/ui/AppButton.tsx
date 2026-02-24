import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { Button as PaperButton, ButtonProps as PaperButtonProps } from 'react-native-paper';
import { colors, radius, spacing, buttonHeight, typography } from '@/constants/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger';

export interface AppButtonProps extends Omit<PaperButtonProps, 'children'> {
  variant?: ButtonVariant;
  children: React.ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<
  ButtonVariant,
  { mode: 'contained' | 'outlined' | 'text'; backgroundColor?: string; textColor?: string; borderColor?: string }
> = {
  primary: { mode: 'contained', backgroundColor: colors.primary, textColor: colors.white },
  secondary: { mode: 'contained', backgroundColor: colors.gray200, textColor: colors.gray900 },
  outline: { mode: 'outlined', textColor: colors.primary, borderColor: colors.primary },
  danger: { mode: 'contained', backgroundColor: colors.error, textColor: colors.white },
};

export function AppButton({
  variant = 'primary',
  style,
  contentStyle,
  labelStyle,
  disabled,
  fullWidth,
  children,
  ...rest
}: AppButtonProps) {
  const v = variantStyles[variant];
  const isOutlined = v.mode === 'outlined';
  const bgColor = disabled && v.mode === 'contained' ? colors.gray200 : v.backgroundColor;
  const textColor = disabled && v.mode === 'contained' ? colors.gray500 : v.textColor;

  return (
    <PaperButton
      mode={v.mode}
      disabled={disabled}
      buttonColor={bgColor}
      textColor={textColor}
      style={[
        styles.base,
        fullWidth && styles.fullWidth,
        isOutlined && { borderColor: v.borderColor ?? colors.gray200, borderWidth: 2 },
        style as ViewStyle,
      ]}
      contentStyle={[styles.content, contentStyle]}
      labelStyle={[typography.button, labelStyle]}
      {...rest}
    >
      {children}
    </PaperButton>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: buttonHeight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  fullWidth: { width: '100%' },
  content: { height: buttonHeight },
});
