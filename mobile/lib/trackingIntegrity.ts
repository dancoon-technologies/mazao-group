/**
 * Tamper-resistant tracking: device integrity and fraud signals.
 * Uses react-native-turbo-mock-location-detector (mock GPS) and jail-monkey (root/jailbreak).
 * Combine with backend fraud detection for defense in depth.
 */

import JailMonkey from 'jail-monkey';
import { isMockingLocation } from 'react-native-turbo-mock-location-detector';

/** Speed above this (km/h) is flagged as high speed; backend may reject. */
const HIGH_SPEED_KMH = 100;
/** Speed above this is considered impossible for ground travel. */
const IMPOSSIBLE_SPEED_KMH = 250;

/**
 * Haversine distance in meters.
 */
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

/**
 * Compute speed in km/h between two points given time delta in seconds.
 */
export function computeSpeedKmh(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  timeDeltaSeconds: number
): number {
  if (timeDeltaSeconds <= 0) return 0;
  const meters = haversineMeters(lat1, lon1, lat2, lon2);
  const metersPerSecond = meters / timeDeltaSeconds;
  return (metersPerSecond * 3600) / 1000;
}

export interface DeviceIntegrityResult {
  mock_provider: boolean;
  rooted: boolean;
  speed_kmh: number | null;
  integrity_flags: string[];
}

/**
 * Check if location is from a mock provider (Android / iOS 15+).
 * Uses react-native-turbo-mock-location-detector.
 */
async function detectMockProvider(): Promise<boolean> {
  try {
    const result = await isMockingLocation();
    return result?.isLocationMocked === true;
  } catch {
    // e.g. GPS disabled, no permission, or iOS < 15 (CantDetermine)
    return false;
  }
}

/**
 * Check if device is rooted (Android) or jailbroken (iOS).
 * Uses jail-monkey.
 */
function detectRooted(): boolean {
  try {
    return JailMonkey.isJailBroken() === true;
  } catch {
    return false;
  }
}

/**
 * Build device integrity payload for a location report.
 * Call before enqueueing; pass last reported position/time to compute speed and flags.
 */
export async function getDeviceIntegrityAsync(options: {
  latitude: number;
  longitude: number;
  reportedAt: string;
  lastLat?: number | null;
  lastLon?: number | null;
  lastReportedAt?: string | null;
}): Promise<DeviceIntegrityResult> {
  const flags: string[] = [];
  const [mock_provider, rooted] = await Promise.all([
    detectMockProvider(),
    Promise.resolve(detectRooted()),
  ]);
  if (mock_provider) flags.push('mock_provider');
  if (rooted) flags.push('rooted');

  let speed_kmh: number | null = null;
  if (
    options.lastLat != null &&
    options.lastLon != null &&
    options.lastReportedAt != null
  ) {
    const prev = new Date(options.lastReportedAt).getTime();
    const curr = new Date(options.reportedAt).getTime();
    const deltaSec = (curr - prev) / 1000;
    if (deltaSec > 0) {
      speed_kmh = computeSpeedKmh(
        options.lastLat,
        options.lastLon,
        options.latitude,
        options.longitude,
        deltaSec
      );
      if (speed_kmh >= IMPOSSIBLE_SPEED_KMH) flags.push('impossible_speed');
      else if (speed_kmh >= HIGH_SPEED_KMH) flags.push('high_speed');
    }
  }

  return {
    mock_provider,
    rooted,
    speed_kmh,
    integrity_flags: flags,
  };
}
