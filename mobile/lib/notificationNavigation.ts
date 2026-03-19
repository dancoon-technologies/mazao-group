import type { Href } from 'expo-router';

function str(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s || undefined;
}

/**
 * Map backend / Expo push `data` (and in-app `action_data`) to an expo-router href.
 * Backend uses string values; we coerce unknowns for safety.
 */
export function notificationPayloadToHref(
  raw: Record<string, unknown> | null | undefined,
  options?: { defaultWhenEmpty?: Href | null }
): Href | null {
  const fallback = options?.defaultWhenEmpty ?? null;
  if (!raw || typeof raw !== 'object') {
    return fallback;
  }

  const screen = str(raw.screen);
  const scheduleId = str(raw.scheduleId);
  const visitId = str(raw.visitId);
  const planMode = str(raw.planMode);

  const hasTarget = Boolean(screen || scheduleId || visitId);
  if (!hasTarget) {
    return fallback;
  }

  switch (screen) {
    case 'route-report':
      return '/(app)/route-report' as Href;
    case 'schedules':
      return '/(app)/(tabs)/schedules' as Href;
    case 'edit-schedule':
      if (scheduleId) {
        return {
          pathname: '/(app)/edit-schedule/[id]',
          params: { id: scheduleId },
        } as Href;
      }
      return '/(app)/(tabs)/schedules' as Href;
    case 'visit':
    case 'visits':
      if (visitId) {
        return {
          pathname: '/(app)/visits/[id]',
          params: { id: visitId },
        } as Href;
      }
      return '/(app)/(tabs)/visits' as Href;
    case 'propose-schedule':
      if (planMode) {
        return {
          pathname: '/(app)/propose-schedule',
          params: { planMode },
        } as Href;
      }
      return '/(app)/propose-schedule' as Href;
    case 'profile':
      return '/(app)/(tabs)/profile' as Href;
    case 'notifications':
      return '/(app)/notifications' as Href;
    default:
      break;
  }

  if (scheduleId) {
    return {
      pathname: '/(app)/edit-schedule/[id]',
      params: { id: scheduleId },
    } as Href;
  }
  if (visitId) {
    return {
      pathname: '/(app)/visits/[id]',
      params: { id: visitId },
    } as Href;
  }

  return fallback;
}

export function navigateFromNotificationPayload(
  router: { push: (href: Href) => void },
  raw: Record<string, unknown> | null | undefined,
  options?: { defaultWhenEmpty?: Href | null }
): void {
  const href = notificationPayloadToHref(raw, options);
  if (href) {
    router.push(href);
  }
}
