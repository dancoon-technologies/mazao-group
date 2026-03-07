/**
 * Shared date and status formatting for the mobile app.
 */

import { colors } from '@/constants/theme';

export function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

export function formatDateHeader(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function formatDateShort(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function visitStatusColor(verification_status: string): string {
  const s = (verification_status || '').toLowerCase();
  if (s === 'verified') return colors.primary;
  if (s === 'rejected') return colors.error;
  return colors.warning;
}

export function visitStatusLabel(verification_status: string): string {
  const s = (verification_status || '').toLowerCase();
  if (s === 'verified') return 'Verified';
  if (s === 'rejected') return 'Rejected';
  return 'Pending';
}

export type ScheduleStatus = 'proposed' | 'accepted' | 'rejected';

export function scheduleStatusColor(status: ScheduleStatus): string {
  if (status === 'accepted') return colors.primary;
  if (status === 'rejected') return colors.error;
  return colors.warning;
}

export function scheduleStatusLabel(status: ScheduleStatus): string {
  if (status === 'proposed') return 'Pending';
  if (status === 'accepted') return 'Accepted';
  if (status === 'rejected') return 'Rejected';
  return status;
}

export { colors };
