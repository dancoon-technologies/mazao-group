/**
 * Location tracking during working hours: collect GPS, battery %, and device info.
 * Offline-first: enqueue to sync queue; syncWithServer pushes batch when online.
 * Runs only when app is in foreground and within working hours to save battery.
 */

import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { enqueueLocationReport } from '@/lib/syncWithServer';
import { logger } from '@/lib/logger';

/** Default working hours (0–23) and interval when backend config is unavailable. */
const DEFAULT_WORKING_HOUR_START = 6;
const DEFAULT_WORKING_HOUR_END = 18;
const DEFAULT_INTERVAL_MINUTES = 10;

/** Current config from admin (set by startTracking). */
let workingHourStart = DEFAULT_WORKING_HOUR_START;
let workingHourEnd = DEFAULT_WORKING_HOUR_END;
let trackingIntervalMs = DEFAULT_INTERVAL_MINUTES * 60 * 1000;

function getDeviceInfo(): Record<string, unknown> {
  const deviceName = Constants.deviceName ?? Device.deviceName ?? Platform.OS;
  const osVersion = Platform.Version != null ? String(Platform.Version) : '';
  const os = Platform.OS === 'ios' ? `iOS ${osVersion}` : `Android ${osVersion}`;
  return {
    device_name: deviceName,
    os,
    app_version: Constants.expoConfig?.version ?? Constants.manifest?.version ?? '1.0',
    platform: Platform.OS,
  };
}

async function getBatteryPercent(): Promise<number | null> {
  try {
    const battery = await import('expo-battery').then((m) => m.getBatteryLevelAsync());
    if (typeof battery === 'number' && battery >= 0 && battery <= 1) return Math.round(battery * 100);
    return null;
  } catch {
    return null;
  }
}

function isWithinWorkingHours(): boolean {
  const now = new Date();
  const hour = now.getHours();
  return hour >= workingHourStart && hour < workingHourEnd;
}

let trackingIntervalId: ReturnType<typeof setInterval> | null = null;

export async function collectAndEnqueueLocationReport(): Promise<void> {
  if (!isWithinWorkingHours()) return;
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Highest,
      mayShowUserSettingsDialog: false,
    });
    const coords = location.coords;
    const reportedAt = new Date().toISOString();
    const batteryPercent = await getBatteryPercent();
    const deviceInfo = getDeviceInfo();
    await enqueueLocationReport({
      reported_at: reportedAt,
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy ?? null,
      battery_percent: batteryPercent,
      device_info: deviceInfo,
    });
    logger.info('Tracking: enqueued location report', { lat: coords.latitude, lon: coords.longitude, battery: batteryPercent });
  } catch (e) {
    logger.warn('Tracking: collect failed', e instanceof Error ? e.message : e);
  }
}

export interface TrackingConfig {
  working_hour_start?: number;
  working_hour_end?: number;
  interval_minutes?: number;
}

/**
 * Start periodic location tracking during working hours when app is in foreground.
 * Pass config from GET /api/options/ (tracking_settings) to use admin-configured hours.
 * Call stopTracking() when user logs out or app backgrounds if needed.
 */
export function startTracking(config?: TrackingConfig): void {
  if (trackingIntervalId) return;
  if (config?.working_hour_start != null) {
    workingHourStart = Math.max(0, Math.min(23, config.working_hour_start));
  } else {
    workingHourStart = DEFAULT_WORKING_HOUR_START;
  }
  if (config?.working_hour_end != null) {
    workingHourEnd = Math.max(0, Math.min(23, config.working_hour_end));
  } else {
    workingHourEnd = DEFAULT_WORKING_HOUR_END;
  }
  if (config?.interval_minutes != null) {
    trackingIntervalMs = Math.max(1, Math.min(120, config.interval_minutes)) * 60 * 1000;
  } else {
    trackingIntervalMs = DEFAULT_INTERVAL_MINUTES * 60 * 1000;
  }
  collectAndEnqueueLocationReport();
  trackingIntervalId = setInterval(collectAndEnqueueLocationReport, trackingIntervalMs);
  logger.info('Tracking: started %s–%s (interval %s min)', workingHourStart, workingHourEnd, trackingIntervalMs / 60000);
}

export function stopTracking(): void {
  if (trackingIntervalId) {
    clearInterval(trackingIntervalId);
    trackingIntervalId = null;
    logger.info('Tracking: stopped');
  }
}
