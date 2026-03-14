"use client";

import React, { useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Circle,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import type { LocationReport } from "@/lib/types";

const MAP_STYLE = { width: "100%", height: 400 };

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

function displayAccuracy(
  accuracy: number | null | undefined
): number | null {
  if (accuracy == null || accuracy <= 0 || !Number.isFinite(accuracy))
    return null;
  return Math.max(5, Math.min(500, accuracy));
}

function MapFitBounds({ reports }: { reports: LocationReport[] }) {
  const map = useMap();
  React.useEffect(() => {
    if (reports.length === 0) return;
    if (reports.length === 1) {
      map.setView([reports[0].latitude, reports[0].longitude], 14);
      return;
    }
    const bounds = L.latLngBounds(
      reports.map((r) => [r.latitude, r.longitude] as L.LatLngTuple)
    );
    map.fitBounds(bounds, { padding: [24, 24] });
  }, [map, reports]);
  return null;
}

export type TrackingMapOSMProps = {
  reports: LocationReport[];
  center: [number, number];
  zoom: number;
  singleUserPathMode?: boolean;
};

export function TrackingMapOSM({
  reports,
  center,
  zoom,
  singleUserPathMode = false,
}: TrackingMapOSMProps) {
  const uniqueUserIds = useMemo(() => {
    const set = new Set(reports.map((r) => r.user_id));
    return Array.from(set);
  }, [reports]);

  const isSingleUser = uniqueUserIds.length === 1;
  const showPath = singleUserPathMode && isSingleUser && reports.length > 1;

  const reportTime = (r: LocationReport) =>
    (r.reported_at_server ?? r.reported_at);
  const pathPositions = useMemo(() => {
    if (!showPath) return [];
    const sorted = [...reports].sort(
      (a, b) =>
        new Date(reportTime(a)).getTime() - new Date(reportTime(b)).getTime()
    );
    return sorted.map((r) => [r.latitude, r.longitude] as [number, number]);
  }, [showPath, reports]);

  const pathReportsSorted = useMemo(() => {
    if (!showPath) return [];
    return [...reports].sort(
      (a, b) =>
        new Date(reportTime(a)).getTime() - new Date(reportTime(b)).getTime()
    );
  }, [showPath, reports]);

  const listToRender = showPath ? pathReportsSorted : reports;
  const defaultCenter: [number, number] = center;
  const pathColor = "#228be6";

  return (
    <div style={MAP_STYLE} className="rounded-md overflow-hidden">
      <MapContainer
        center={defaultCenter}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapFitBounds reports={reports} />
        {showPath && pathPositions.length > 1 && (
          <Polyline
            positions={pathPositions}
            pathOptions={{
              color: pathColor,
              weight: 5,
              opacity: 0.85,
            }}
          />
        )}
        {listToRender.map((r) => {
          const color =
            uniqueUserIds.length > 1
              ? USER_COLORS[hashUserIdToColorIndex(r.user_id)]
              : pathColor;
          const accMeters = displayAccuracy(r.accuracy);
          return (
            <React.Fragment key={r.id}>
              {accMeters != null && (
                <Circle
                  center={[r.latitude, r.longitude]}
                  radius={accMeters}
                  pathOptions={{
                    color,
                    fillColor: color,
                    fillOpacity: 0.15,
                    weight: 1.5,
                  }}
                />
              )}
              <CircleMarker
                center={[r.latitude, r.longitude]}
                radius={6}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: 1,
                  weight: 2,
                }}
              >
                <Popup>
                  <div style={{ padding: 4, minWidth: 160 }}>
                    <strong>{r.user_display_name || r.user_email}</strong>
                    <br />
                    {(() => {
                      const t = r.reported_at_server ?? r.reported_at;
                      const d = new Date(t);
                      return Number.isNaN(d.getTime()) ? String(t) : d.toLocaleString();
                    })()}
                    {r.accuracy != null && (
                      <> · Accuracy ±{Math.round(r.accuracy)} m</>
                    )}
                    {r.battery_percent != null && (
                      <> · Battery {r.battery_percent}%</>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            </React.Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
}
