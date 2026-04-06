"use client";

import { Box, Text, useMantineTheme } from "@mantine/core";
import { useMemo } from "react";

export type LocationMiniMapPoint = {
  id: string;
  latitude: number;
  longitude: number;
  color?: string;
  colorKey?: string;
};

const USER_COLORS = ["#228be6", "#40c057", "#fd7e14", "#be4bdb", "#fa5252", "#15aabf", "#fab005", "#7950f2"];

function hashToIndex(s: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) % mod;
}

function computeBounds(points: LocationMiniMapPoint[]): {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
} | null {
  const valid = points.filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
  if (valid.length === 0) return null;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const p of valid) {
    minLat = Math.min(minLat, p.latitude);
    maxLat = Math.max(maxLat, p.latitude);
    minLon = Math.min(minLon, p.longitude);
    maxLon = Math.max(maxLon, p.longitude);
  }
  const latSpan = maxLat - minLat;
  const lonSpan = maxLon - minLon;
  const padLat = latSpan < 1e-9 ? 0.015 : Math.max(latSpan * 0.12, 0.005);
  const padLon = lonSpan < 1e-9 ? 0.015 : Math.max(lonSpan * 0.12, 0.005);
  return {
    minLat: minLat - padLat,
    maxLat: maxLat + padLat,
    minLon: minLon - padLon,
    maxLon: maxLon + padLon,
  };
}

export type LocationMiniMapProps = {
  points: LocationMiniMapPoint[];
  height?: number;
  title?: string;
  subtitle?: string;
  "aria-label"?: string;
};

/**
 * Compact map preview (normalized bounds + dots), aligned with the mobile app’s LocationMiniMap.
 */
export function LocationMiniMap({
  points,
  height = 220,
  title,
  subtitle,
  "aria-label": ariaLabel,
}: LocationMiniMapProps) {
  const theme = useMantineTheme();
  const fallbackColor = theme.colors?.blue?.[6] ?? "#228be6";

  const bounds = useMemo(() => computeBounds(points), [points]);

  const dots = useMemo(() => {
    if (!bounds) return [];
    const lonSpan = Math.max(bounds.maxLon - bounds.minLon, 1e-9);
    const latSpan = Math.max(bounds.maxLat - bounds.minLat, 1e-9);
    return points
      .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
      .map((p) => {
        const x = ((p.longitude - bounds.minLon) / lonSpan) * 100;
        const y = ((bounds.maxLat - p.latitude) / latSpan) * 100;
        const color =
          p.color ?? USER_COLORS[hashToIndex(p.colorKey ?? p.id, USER_COLORS.length)] ?? fallbackColor;
        return { id: p.id, x, y, color };
      });
  }, [bounds, fallbackColor, points]);

  if (!bounds || dots.length === 0) {
    return null;
  }

  return (
    <Box aria-label={ariaLabel}>
      {title ? (
        <Text size="sm" fw={700} mb={4}>
          {title}
        </Text>
      ) : null}
      {subtitle ? (
        <Text size="xs" c="dimmed" mb="sm">
          {subtitle}
        </Text>
      ) : null}
      <Box
        pos="relative"
        style={{
          height,
          borderRadius: 12,
          backgroundColor: theme.colors.gray[2],
          overflow: "hidden",
        }}
      >
        {dots.map((d) => (
          <Box
            key={d.id}
            pos="absolute"
            style={{
              left: `${d.x}%`,
              top: `${d.y}%`,
              width: 10,
              height: 10,
              marginLeft: -5,
              marginTop: -5,
              borderRadius: 5,
              backgroundColor: d.color,
              border: "2px solid white",
            }}
          />
        ))}
      </Box>
    </Box>
  );
}
