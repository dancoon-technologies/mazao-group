import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** Distance between two WGS84 points in metres. */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Device + OS string for visit photo metadata (EXIF / API). */
export function getPhotoDeviceInfo(): string {
  const deviceName = Constants.deviceName ?? Platform.OS;
  const osVersion = Platform.Version != null ? String(Platform.Version) : '';
  const part = Platform.OS === 'ios' ? `iOS ${osVersion}` : `Android ${osVersion}`;
  return [deviceName, part].filter(Boolean).join(', ') || 'Mobile device';
}
