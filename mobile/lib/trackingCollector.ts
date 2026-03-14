/**
 * Location tracking during working hours: collect GPS, battery %, and device info.
 * Works in foreground and background via expo-location startLocationUpdatesAsync.
 * Offline-first: enqueue to sync queue; syncWithServer pushes batch when online.
 */

import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import {
  getEstimatedPosition,
  startSensorSubscription,
  stopSensorSubscription,
  updateFromLocation,
} from '@/lib/deadReckoning';
import { getDeviceClockOffsetSeconds } from '@/lib/deviceClockSync';
import { enqueueLocationReport } from '@/lib/syncWithServer';
import { logger } from '@/lib/logger';

/** Task name for background location updates (must be defined at top level). */
export const LOCATION_TRACKING_TASK = 'mazao-location-tracking';

/** Default working hours (0–23) and interval when backend config is unavailable. */
const DEFAULT_WORKING_HOUR_START = 6;
const DEFAULT_WORKING_HOUR_END = 18;
/** Default: collect location every 1 minute. Backend can override via options tracking_settings.interval_minutes (1–120). */
const DEFAULT_INTERVAL_MINUTES = 1;

/** Only record a new point when the user has moved at least this many meters from the last recorded point. */
const MIN_MOVEMENT_METERS = 10;

/** Last position we sent to the server (so we only record when change is detected). */
let lastEnqueuedLat: number | null = null;
let lastEnqueuedLon: number | null = null;

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

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

function isWithinWorkingHours(): boolean {
  const now = new Date();
  const hour = now.getHours();
  return hour >= workingHourStart && hour < workingHourEnd;
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

/** Background/foreground location task: receives batched locations and enqueues each (during working hours). */
TaskManager.defineTask(LOCATION_TRACKING_TASK, async ({ data, error }) => {
  if (error) {
    logger.warn('Tracking: location task error', error.message);
    return;
  }
  const locations = (data as { locations?: Location.LocationObject[] })?.locations ?? [];
  if (!isWithinWorkingHours()) return;
  const deviceInfo = getDeviceInfo();
  const seenTimestamps = new Set<string>();
  for (const location of locations) {
    try {
      const coords = location.coords;
      const accuracy = coords.accuracy ?? null;
      updateFromLocation(coords.latitude, coords.longitude, accuracy);
      const dr = getEstimatedPosition(coords.latitude, coords.longitude, accuracy);
      const lat = dr?.lat ?? coords.latitude;
      const lon = dr?.lon ?? coords.longitude;
      let reportedAt: string;
      const rawTs = (location as { timestamp?: number }).timestamp;
      if (typeof rawTs === 'number') {
        reportedAt = new Date(rawTs).toISOString();
        // If OS batches locations with the same timestamp, ensure distinct reported_at per row
        while (seenTimestamps.has(reportedAt)) {
          const d = new Date(reportedAt);
          d.setMilliseconds(d.getMilliseconds() + 1);
          reportedAt = d.toISOString();
        }
        seenTimestamps.add(reportedAt);
      } else {
        reportedAt = new Date().toISOString();
      }
      if (lastEnqueuedLat != null && lastEnqueuedLon != null) {
        const dist = haversineMeters(lastEnqueuedLat, lastEnqueuedLon, lat, lon);
        if (dist < MIN_MOVEMENT_METERS) {
          continue;
        }
      }
      lastEnqueuedLat = lat;
      lastEnqueuedLon = lon;

      const batteryPercent = await getBatteryPercent();
      const deviceClockOffsetSeconds = await getDeviceClockOffsetSeconds();
      await enqueueLocationReport({
        reported_at: reportedAt,
        ...(deviceClockOffsetSeconds != null && { device_clock_offset_seconds: deviceClockOffsetSeconds }),
        latitude: lat,
        longitude: lon,
        accuracy: coords.accuracy ?? null,
        battery_percent: batteryPercent,
        device_info: deviceInfo,
      });
      logger.info('Tracking: enqueued location report (change detected)', { lat, lon, battery: batteryPercent });
    } catch (e) {
      logger.warn('Tracking: enqueue failed', e instanceof Error ? e.message : e);
    }
  }
});

export interface TrackingConfig {
  working_hour_start?: number;
  working_hour_end?: number;
  interval_minutes?: number;
}

let isTrackingStarted = false;

/**
 * Start location tracking during working hours. Uses background location so updates
 * continue when the app is in the background. Request background permission first.
 * Call stopTracking() when user logs out.
 */
export async function startTracking(config?: TrackingConfig): Promise<void> {
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

  const { status: foregroundStatus } = await Location.getForegroundPermissionsAsync();
  if (foregroundStatus !== 'granted') {
    logger.warn('Tracking: foreground location not granted');
    return;
  }

  try {
    const { status: backgroundStatus } = await Location.getBackgroundPermissionsAsync();
    if (backgroundStatus !== 'granted') {
      await Location.requestBackgroundPermissionsAsync();
    }
  } catch (e) {
    logger.warn('Tracking: background permission request failed', e instanceof Error ? e.message : e);
  }

  lastEnqueuedLat = null;
  lastEnqueuedLon = null;

  try {
    await Location.startLocationUpdatesAsync(LOCATION_TRACKING_TASK, {
      accuracy: Location.LocationAccuracy.Highest,
      timeInterval: trackingIntervalMs,
      distanceInterval: 0,
      foregroundService: {
        notificationTitle: 'Mazao tracking',
        notificationBody: 'Recording your location during field work.',
      },
    });
    startSensorSubscription();
    isTrackingStarted = true;
    logger.info('Tracking: started', { workingHourStart, workingHourEnd, intervalMin: trackingIntervalMs / 60000 });
  } catch (e) {
    logger.warn('Tracking: startLocationUpdatesAsync failed', e instanceof Error ? e.message : e);
  }
}

export async function stopTracking(): Promise<void> {
  if (!isTrackingStarted) return;
  stopSensorSubscription();
  try {
    await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK);
    isTrackingStarted = false;
    logger.info('Tracking: stopped');
  } catch (e) {
    logger.warn('Tracking: stop failed', e instanceof Error ? e.message : e);
  }
}
