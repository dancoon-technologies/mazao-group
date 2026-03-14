/**
 * Optional dead reckoning when GPS accuracy is poor (indoors, urban canyons).
 * Uses accelerometer + gyroscope to estimate position from last known good fix.
 * Only active when tracking is started; sensor subscription is started/stopped with tracking.
 */

import { Accelerometer, Gyroscope } from 'expo-sensors';

const POOR_ACCURACY_THRESHOLD_M = 50;
const METERS_PER_DEGREE_LAT = 111320;
const SENSOR_UPDATE_MS = 100;

let lastGoodLat: number | null = null;
let lastGoodLon: number | null = null;
let lastGoodTime: number | null = null;
let vx = 0;
let vy = 0;
let headingRad = 0;
let estimatedLat: number | null = null;
let estimatedLon: number | null = null;
let subscription: { remove: () => void } | null = null;

function metersToLatLonDelta(mx: number, my: number, atLat: number): { dLat: number; dLon: number } {
  const dLat = my / METERS_PER_DEGREE_LAT;
  const dLon = mx / (METERS_PER_DEGREE_LAT * Math.max(0.01, Math.cos((atLat * Math.PI) / 180)));
  return { dLat, dLon };
}

function onSensorUpdate(accel: { x: number; y: number; z: number }, gyro: { x: number; y: number; z: number }, dtSec: number) {
  if (lastGoodLat == null || lastGoodLon == null || lastGoodTime == null) return;
  const g = 9.81;
  headingRad += (gyro.z * Math.PI) / 180 * dtSec;
  const cosH = Math.cos(headingRad);
  const sinH = Math.sin(headingRad);
  const ax = (accel.x * g - 0) * 0.95;
  const ay = (accel.y * g - 0) * 0.95;
  const axWorld = ax * cosH - ay * sinH;
  const ayWorld = ax * sinH + ay * cosH;
  vx += axWorld * dtSec;
  vy += ayWorld * dtSec;
  const damp = 0.98;
  vx *= damp;
  vy *= damp;
  const lat = estimatedLat ?? lastGoodLat;
  const lon = estimatedLon ?? lastGoodLon;
  const { dLat, dLon } = metersToLatLonDelta(vx * dtSec, vy * dtSec, lat);
  estimatedLat = lat + dLat;
  estimatedLon = lon + dLon;
}

let lastAccel: { x: number; y: number; z: number } | null = null;
let lastGyro: { x: number; y: number; z: number } | null = null;
let lastSensorTime: number | null = null;

function flushSensorUpdate() {
  if (lastAccel == null || lastGyro == null || lastSensorTime == null) return;
  const now = Date.now() / 1000;
  const dt = Math.min(0.5, now - lastSensorTime);
  lastSensorTime = now;
  onSensorUpdate(lastAccel, lastGyro, dt);
}

export const POOR_ACCURACY_THRESHOLD_METERS = POOR_ACCURACY_THRESHOLD_M;

/**
 * Call when we get a location fix. If accuracy is good, update last good position and reset DR state.
 */
export function updateFromLocation(lat: number, lon: number, accuracy: number | null): void {
  const acc = accuracy ?? 999;
  if (acc <= POOR_ACCURACY_THRESHOLD_M) {
    lastGoodLat = lat;
    lastGoodLon = lon;
    lastGoodTime = Date.now() / 1000;
    vx = 0;
    vy = 0;
    estimatedLat = lat;
    estimatedLon = lon;
  }
}

/**
 * When accuracy is poor, return estimated (lat, lon) from dead reckoning if available;
 * otherwise last good position to avoid jumping to a bad GPS fix.
 */
export function getEstimatedPosition(
  _currentLat: number,
  _currentLon: number,
  accuracy: number | null
): { lat: number; lon: number } | null {
  const acc = accuracy ?? 999;
  if (acc <= POOR_ACCURACY_THRESHOLD_M) return null;
  if (lastGoodLat == null || lastGoodLon == null) return null;
  flushSensorUpdate();
  if (estimatedLat != null && estimatedLon != null) {
    return { lat: estimatedLat, lon: estimatedLon };
  }
  return { lat: lastGoodLat, lon: lastGoodLon };
}

/**
 * Start listening to accelerometer and gyroscope. Call when tracking starts.
 * No-op if sensors are unavailable (e.g. on some simulators).
 */
export function startSensorSubscription(): void {
  if (subscription != null) return;
  try {
    Accelerometer.setUpdateInterval(SENSOR_UPDATE_MS);
    Gyroscope.setUpdateInterval(SENSOR_UPDATE_MS);
  } catch {
    return;
  }
  const subAcc = Accelerometer.addListener((data: { x: number; y: number; z: number }) => {
    lastAccel = { x: data.x, y: data.y, z: data.z };
    if (lastSensorTime == null) lastSensorTime = Date.now() / 1000;
  });
  const subGyr = Gyroscope.addListener((data: { x: number; y: number; z: number }) => {
    lastGyro = { x: data.x, y: data.y, z: data.z };
    if (lastSensorTime == null) lastSensorTime = Date.now() / 1000;
    flushSensorUpdate();
  });
  subscription = {
    remove: () => {
      subAcc.remove();
      subGyr.remove();
      subscription = null;
      lastAccel = null;
      lastGyro = null;
      lastSensorTime = null;
    },
  };
}

/**
 * Stop sensor subscription. Call when tracking stops.
 */
export function stopSensorSubscription(): void {
  if (subscription != null) {
    subscription.remove();
    subscription = null;
  }
}
