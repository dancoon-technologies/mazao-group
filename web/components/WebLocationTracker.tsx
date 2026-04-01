"use client";

import { useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { ROLES } from "@/lib/constants";
import type { UserRole } from "@/lib/types";

type Props = {
  isAuthenticated: boolean;
  role: UserRole | null;
  intervalMinutes?: number;
  workingHourStart?: number;
  workingHourEnd?: number;
};

function isWithinWorkingHours(hour: number, start: number, end: number): boolean {
  if (start === end) return true;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

export function WebLocationTracker({
  isAuthenticated,
  role,
  intervalMinutes = 1,
  workingHourStart = 6,
  workingHourEnd = 18,
}: Props) {
  const inFlightRef = useRef(false);

  useEffect(() => {
    const shouldTrack =
      isAuthenticated &&
      (role === ROLES.OFFICER || role === ROLES.SUPERVISOR);
    if (!shouldTrack) return;
    if (typeof window === "undefined" || !navigator.geolocation) return;

    const captureAndSend = async () => {
      const now = new Date();
      if (!isWithinWorkingHours(now.getHours(), workingHourStart, workingHourEnd)) return;
      if (document.visibilityState !== "visible") return;
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 30000,
          });
        });
        await api.sendTrackingReport({
          reported_at: now.toISOString(),
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
          device_info: { platform: "web", userAgent: navigator.userAgent },
        });
      } catch {
        // Silent: tracking should not block user workflows.
      } finally {
        inFlightRef.current = false;
      }
    };

    const safeMinutes = Math.max(1, Math.min(120, Math.round(intervalMinutes || 1)));
    const intervalMs = safeMinutes * 60 * 1000;
    const interval = window.setInterval(captureAndSend, intervalMs);
    captureAndSend();
    return () => {
      window.clearInterval(interval);
    };
  }, [isAuthenticated, role, intervalMinutes, workingHourStart, workingHourEnd]);

  return null;
}
