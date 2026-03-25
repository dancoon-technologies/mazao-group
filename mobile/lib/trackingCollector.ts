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
import { getDeviceIntegrityAsync } from '@/lib/trackingIntegrity';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { enqueueLocationReport } from '@/lib/syncWithServer';
import { logger } from '@/lib/logger';

/** Task name for background location updates (must be defined at top level). */
export const LOCATION_TRACKING_TASK = 'mazao-location-tracking';

const TRACKING_LAST_SENT_KEY = 'mazao_tracking_last_sent';

/** Default working hours (0–23) and interval when backend config is unavailable. */
const DEFAULT_WORKING_HOUR_START = 6;
const DEFAULT_WORKING_HOUR_END = 18;
/** Default: collect location every 1 minute. Backend can override via options tracking_settings.interval_minutes (1–120). */
const DEFAULT_INTERVAL_MINUTES = 1;

/** Only record a new point when the user has moved at least this many meters from the last recorded point. */
const MIN_MOVEMENT_METERS = 15;

/** Minimum seconds between reports when stationary (avoids duplicate same-place rows and fixes duration). */
const MIN_INTERVAL_SECONDS = 45;

/** Last position and time we sent (in-memory; also persisted so background task runs see it). */
let lastEnqueuedLat: number | null = null;
let lastEnqueuedLon: number | null = null;
let lastEnqueuedAt: string | null = null;

async function loadLastEnqueued(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(TRACKING_LAST_SENT_KEY);
    if (!raw) return;
    const o = JSON.parse(raw) as { lat: number; lon: number; at: string };
    if (typeof o?.lat === 'number' && typeof o?.lon === 'number' && typeof o?.at === 'string') {
      lastEnqueuedLat = o.lat;
      lastEnqueuedLon = o.lon;
      lastEnqueuedAt = o.at;
    }
  } catch {
    // ignore
  }
}

async function saveLastEnqueued(lat: number, lon: number, at: string): Promise<void> {
  lastEnqueuedLat = lat;
  lastEnqueuedLon = lon;
  lastEnqueuedAt = at;
  try {
    await AsyncStorage.setItem(TRACKING_LAST_SENT_KEY, JSON.stringify({ lat, lon, at }));
  } catch {
    // ignore
  }
}

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

/** Background/foreground location task: receives batched locations and enqueues only on change or min interval. */
TaskManager.defineTask(LOCATION_TRACKING_TASK, async ({ data, error }) => {
  if (error) {
    logger.warn('Tracking: location task error', error.message);
    return;
  }
  const locations = (data as { locations?: Location.LocationObject[] })?.locations ?? [];
  if (!isWithinWorkingHours()) return;
  await loadLastEnqueued();
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
        while (seenTimestamps.has(reportedAt)) {
          const d = new Date(reportedAt);
          d.setMilliseconds(d.getMilliseconds() + 1);
          reportedAt = d.toISOString();
        }
        seenTimestamps.add(reportedAt);
      } else {
        reportedAt = new Date().toISOString();
      }
      const dist = (lastEnqueuedLat != null && lastEnqueuedLon != null)
        ? haversineMeters(lastEnqueuedLat, lastEnqueuedLon, lat, lon)
        : Infinity;
      const secondsSinceLast = lastEnqueuedAt
        ? (new Date(reportedAt).getTime() - new Date(lastEnqueuedAt).getTime()) / 1000
        : Infinity;
      const movedEnough = dist >= MIN_MOVEMENT_METERS;
      const intervalElapsed = secondsSinceLast >= MIN_INTERVAL_SECONDS;
      if (!movedEnough && !intervalElapsed) {
        continue;
      }
      const batteryPercent = await getBatteryPercent();
      const deviceClockOffsetSeconds = await getDeviceClockOffsetSeconds();
      const deviceIntegrity = await getDeviceIntegrityAsync({
        latitude: lat,
        longitude: lon,
        reportedAt,
        lastLat: lastEnqueuedLat,
        lastLon: lastEnqueuedLon,
        lastReportedAt: lastEnqueuedAt,
      });
      if (deviceIntegrity.integrity_flags.length > 0) {
        logger.warn('Tracking: integrity flags', { flags: deviceIntegrity.integrity_flags, speed_kmh: deviceIntegrity.speed_kmh });
      }
      await enqueueLocationReport({
        reported_at: reportedAt,
        ...(deviceClockOffsetSeconds != null && { device_clock_offset_seconds: deviceClockOffsetSeconds }),
        latitude: lat,
        longitude: lon,
        accuracy: coords.accuracy ?? null,
        battery_percent: batteryPercent,
        device_info: deviceInfo,
        device_integrity: {
          mock_provider: deviceIntegrity.mock_provider,
          rooted: deviceIntegrity.rooted,
          speed_kmh: deviceIntegrity.speed_kmh,
          integrity_flags: deviceIntegrity.integrity_flags,
        },
      });
      await saveLastEnqueued(lat, lon, reportedAt);
      logger.info('Tracking: enqueued location report (change or interval)', { lat, lon, battery: batteryPercent });
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
/** Interval that starts/stops location updates at working-hour boundaries. */
let workingHoursCheckIntervalId: ReturnType<typeof setInterval> | null = null;

const WORKING_HOURS_CHECK_MS = 60 * 1000; // check every minute

/**
 * Start or stop location updates based on current time and working hours.
 * Called on a timer so we stop at working_hour_end and start at working_hour_start.
 */
async function applyWorkingHoursState(): Promise<void> {
  const within = isWithinWorkingHours();
  if (within && !isTrackingStarted) {
    const { status: foregroundStatus } = await Location.getForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') return;
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
      logger.info('Tracking: started (within working hours)', { workingHourStart, workingHourEnd });
    } catch (e) {
      logger.warn('Tracking: startLocationUpdatesAsync failed', e instanceof Error ? e.message : e);
    }
  } else if (!within && isTrackingStarted) {
    stopSensorSubscription();
    try {
      await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK);
      isTrackingStarted = false;
      logger.info('Tracking: stopped (outside working hours)', { workingHourStart, workingHourEnd });
    } catch (e) {
      logger.warn('Tracking: stop failed', e instanceof Error ? e.message : e);
    }
  }
}

/**
 * Start location tracking during working hours. Uses background location so updates
 * continue when the app is in the background. Location updates are started only when
 * the current time is within working hours and are stopped automatically at
 * working_hour_end; they start again at working_hour_start. Request background
 * permission first. Call stopTracking() when user logs out.
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

  let { status: foregroundStatus } = await Location.getForegroundPermissionsAsync();
  if (foregroundStatus !== 'granted') {
    try {
      const requested = await Location.requestForegroundPermissionsAsync();
      foregroundStatus = requested.status;
    } catch (e) {
      logger.warn(
        'Tracking: foreground permission request failed',
        e instanceof Error ? e.message : e
      );
      return;
    }
  }
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

  if (workingHoursCheckIntervalId != null) {
    clearInterval(workingHoursCheckIntervalId);
    workingHoursCheckIntervalId = null;
  }

  await applyWorkingHoursState();
  workingHoursCheckIntervalId = setInterval(() => {
    applyWorkingHoursState();
  }, WORKING_HOURS_CHECK_MS);
  logger.info('Tracking: scheduled by working hours', { workingHourStart, workingHourEnd, intervalMin: trackingIntervalMs / 60000 });
}

export async function stopTracking(): Promise<void> {
  if (workingHoursCheckIntervalId != null) {
    clearInterval(workingHoursCheckIntervalId);
    workingHoursCheckIntervalId = null;
  }
  lastEnqueuedLat = null;
  lastEnqueuedLon = null;
  lastEnqueuedAt = null;
  try {
    await AsyncStorage.removeItem(TRACKING_LAST_SENT_KEY);
  } catch {
    // ignore
  }
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
