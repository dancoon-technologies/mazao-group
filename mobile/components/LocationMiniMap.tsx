import { colors, spacing } from '@/constants/theme';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

export type LocationMiniMapPoint = {
  id: string;
  latitude: number;
  longitude: number;
  /** When set, used instead of hashing `colorKey` / `id`. */
  color?: string;
  /** Used with the shared palette when `color` is omitted (e.g. stable color per user). */
  colorKey?: string;
};

const USER_COLORS = ['#228be6', '#40c057', '#fd7e14', '#be4bdb', '#fa5252', '#15aabf', '#fab005', '#7950f2'];

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

type LocationMiniMapProps = {
  points: LocationMiniMapPoint[];
  height?: number;
  title?: string;
  subtitle?: string;
  /** Screen reader description; include coordinates if useful. */
  accessibilityLabel?: string;
};

/**
 * Compact “map” preview: normalized lat/lng bounds with dots, same visual language as Track team.
 */
export function LocationMiniMap({
  points,
  height = 220,
  title,
  subtitle,
  accessibilityLabel,
}: LocationMiniMapProps) {
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
          p.color ??
          USER_COLORS[hashToIndex(p.colorKey ?? p.id, USER_COLORS.length)] ??
          colors.primary;
        return { id: p.id, x, y, color };
      });
  }, [bounds, points]);

  if (!bounds || dots.length === 0) {
    return null;
  }

  return (
    <View accessibilityLabel={accessibilityLabel}>
      {title ? (
        <Text variant="labelLarge" style={styles.mapTitle}>
          {title}
        </Text>
      ) : null}
      {subtitle ? (
        <Text variant="bodySmall" style={styles.mapSub}>
          {subtitle}
        </Text>
      ) : null}
      <View style={[styles.mapArea, { height }]}>
        {dots.map((d) => (
          <View
            key={d.id}
            style={[
              styles.dot,
              {
                backgroundColor: d.color,
                left: `${d.x}%`,
                top: `${d.y}%`,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapTitle: { fontWeight: '700', marginBottom: 2 },
  mapSub: { color: colors.gray500, marginBottom: spacing.sm },
  mapArea: {
    borderRadius: 12,
    backgroundColor: colors.gray200,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    transform: [{ translateX: -5 }, { translateY: -5 }],
    borderWidth: 2,
    borderColor: colors.white,
  },
});
