"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Controlled form state with field updater and reset (DRY for form pages).
 * Keeps initial state ref so reset() is stable and restores first initial value.
 */
export function useFormFields<T extends Record<string, string>>(
  initialState: T
): [T, (field: keyof T, value: string) => void, (next?: Partial<T>) => void] {
  const initialRef = useRef(initialState);
  const [values, setValues] = useState<T>(initialState);

  const updateField = useCallback((field: keyof T, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  const reset = useCallback((next?: Partial<T>) => {
    setValues((prev) => (next ? { ...prev, ...next } : { ...initialRef.current }));
  }, []);

  return [values, updateField, reset];
}
