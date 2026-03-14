"use client";

import {
  MapContainer,
  TileLayer,
  Popup,
  Polyline,
  CircleMarker,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { useMemo } from "react";
import type { LocationReport } from "@/lib/types";

/** Colors for multiple users (all-people view). */
const USER_COLORS = [
  "#228be6",
  "#40c057",
  "#fd7e14",
  "#be4bdb",
  "#fa5252",
  "#15aabf",
  "#fab005",
  "#7950f2",
];

function hashUserIdToColorIndex(userId: string): number {
  let h = 0;
  for (let i = 0; i < userId.length; i++) {
    h = (h << 5) - h + userId.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) % USER_COLORS.length;
}

function MapFitBounds({ reports }: { reports: LocationReport[] }) {
  const map = useMap();
  if (reports.length === 0) return null;
  if (reports.length === 1) {
    map.setView([reports[0].latitude, reports[0].longitude], 14);
    return null;
  }
  const bounds = L.latLngBounds(
    reports.map((r) => [r.latitude, r.longitude] as [number, number])
  );
  map.fitBounds(bounds, { padding: [24, 24], maxZoom: 14 });
  return null;
}

type TrackingMapProps = {
  reports: LocationReport[];
  center: [number, number];
  zoom: number;
  /** When true, show path (polyline) + point markers for a single user's route. */
  singleUserPathMode?: boolean;
};

export function TrackingMap({
  reports,
  center,
  zoom,
  singleUserPathMode = false,
}: TrackingMapProps) {
  const uniqueUserIds = useMemo(() => {
    const set = new Set(reports.map((r) => r.user_id));
    return Array.from(set);
  }, [reports]);

  const isSingleUser = uniqueUserIds.length === 1;
  const showPath = singleUserPathMode && isSingleUser && reports.length > 1;

  const pathPositions = useMemo(() => {
    if (!showPath) return [];
    const sorted = [...reports].sort(
      (a, b) =>
        new Date(a.reported_at).getTime() - new Date(b.reported_at).getTime()
    );
    return sorted.map((r) => [r.latitude, r.longitude] as [number, number]);
  }, [showPath, reports]);

  const pathReportsSorted = useMemo(() => {
    if (!showPath) return [];
    return [...reports].sort(
      (a, b) =>
        new Date(a.reported_at).getTime() - new Date(b.reported_at).getTime()
    );
  }, [showPath, reports]);

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className="h-full w-full"
      style={{ height: 400, width: "100%", zIndex: 0 }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapFitBounds reports={reports} />

      {showPath && (
        <>
          <Polyline
            positions={pathPositions}
            pathOptions={{
              color: "#228be6",
              weight: 4,
              opacity: 0.8,
            }}
          />
          {pathReportsSorted.map((r) => (
            <CircleMarker
              key={r.id}
              center={[r.latitude, r.longitude]}
              radius={6}
              pathOptions={{
                color: "#228be6",
                fillColor: "#228be6",
                fillOpacity: 0.9,
                weight: 2,
              }}
            >
              <Popup>
                <strong>{r.user_display_name || r.user_email}</strong>
                <br />
                {new Date(r.reported_at).toLocaleString()}
                {r.battery_percent != null && (
                  <> · Battery {r.battery_percent}%</>
                )}
              </Popup>
            </CircleMarker>
          ))}
        </>
      )}

      {!showPath &&
        reports.map((r) => {
          const color =
            uniqueUserIds.length > 1
              ? USER_COLORS[hashUserIdToColorIndex(r.user_id)]
              : "#228be6";
          return (
            <CircleMarker
              key={r.id}
              center={[r.latitude, r.longitude]}
              radius={uniqueUserIds.length > 1 ? 10 : 8}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.9,
                weight: 2,
              }}
            >
              <Popup>
                <strong>{r.user_display_name || r.user_email}</strong>
                <br />
                {new Date(r.reported_at).toLocaleString()}
                {r.battery_percent != null && (
                  <> · Battery {r.battery_percent}%</>
                )}
              </Popup>
            </CircleMarker>
          );
        })}
    </MapContainer>
  );
}
