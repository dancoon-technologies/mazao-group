"use client";

import {
  APIProvider,
  Map,
  useMap,
  Marker,
  InfoWindow,
} from "@vis.gl/react-google-maps";
import React, { useEffect, useMemo, useState } from "react";
import type { LocationReport } from "@/lib/types";
import { TrackingMapOSM } from "./TrackingMapOSM";

const MAP_CONTAINER_STYLE = { width: "100%", height: 400 };

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

function displayAccuracy(
  accuracy: number | null | undefined
): number | null {
  if (accuracy == null || accuracy <= 0 || !Number.isFinite(accuracy))
    return null;
  return Math.max(5, Math.min(500, accuracy));
}

/** Renders polyline and accuracy circles via native Maps API; fits bounds when reports change. */
function MapOverlays({
  reports,
  pathPositions,
  showPath,
  uniqueUserIds,
}: {
  reports: LocationReport[];
  pathPositions: { lat: number; lng: number }[];
  showPath: boolean;
  uniqueUserIds: string[];
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || reports.length === 0) return;
    if (reports.length === 1) {
      map.setCenter({ lat: reports[0].latitude, lng: reports[0].longitude });
      map.setZoom(14);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    reports.forEach((r) => bounds.extend({ lat: r.latitude, lng: r.longitude }));
    map.fitBounds(bounds, { top: 24, right: 24, bottom: 24, left: 24 });
  }, [map, reports]);

  useEffect(() => {
    if (!map) return;
    const polylines: google.maps.Polyline[] = [];
    const circles: google.maps.Circle[] = [];

    if (showPath && pathPositions.length > 1) {
      const polyline = new google.maps.Polyline({
        path: pathPositions,
        strokeColor: "#228be6",
        strokeWeight: 5,
        strokeOpacity: 0.85,
        map,
      });
      polylines.push(polyline);
    }

    reports.forEach((r) => {
      const accMeters = displayAccuracy(r.accuracy);
      if (accMeters != null) {
        const color = showPath
          ? "#228be6"
          : uniqueUserIds.length > 1
            ? USER_COLORS[hashUserIdToColorIndex(r.user_id)]
            : "#228be6";
        const circle = new google.maps.Circle({
          center: { lat: r.latitude, lng: r.longitude },
          radius: accMeters,
          strokeColor: color,
          fillColor: color,
          fillOpacity: showPath ? 0.12 : 0.15,
          strokeWeight: 1.5,
          map,
        });
        circles.push(circle);
      }
    });

    return () => {
      polylines.forEach((p) => p.setMap(null));
      circles.forEach((c) => c.setMap(null));
    };
  }, [map, reports, pathPositions, showPath, uniqueUserIds]);

  return null;
}

type TrackingMapProps = {
  reports: LocationReport[];
  center: [number, number];
  zoom: number;
  /** When true, show path (polyline) + point markers for a single user's route. */
  singleUserPathMode?: boolean;
};

function TrackingMapInner({
  reports,
  center,
  zoom,
  singleUserPathMode = false,
}: TrackingMapProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);

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
    return sorted.map((r) => ({ lat: r.latitude, lng: r.longitude }));
  }, [showPath, reports]);

  const pathReportsSorted = useMemo(() => {
    if (!showPath) return [];
    return [...reports].sort(
      (a, b) =>
        new Date(reportTime(a)).getTime() - new Date(reportTime(b)).getTime()
    );
  }, [showPath, reports]);

  const listToRender = showPath ? pathReportsSorted : reports;

  return (
    <Map
      style={MAP_CONTAINER_STYLE}
      defaultCenter={{ lat: center[0], lng: center[1] }}
      defaultZoom={zoom}
      gestureHandling="greedy"
      mapTypeControl
      fullscreenControl
    >
      <MapOverlays
        reports={reports}
        pathPositions={pathPositions}
        showPath={showPath}
        uniqueUserIds={uniqueUserIds}
      />
      {listToRender.map((r) => (
        <React.Fragment key={r.id}>
          <Marker
              position={{ lat: r.latitude, lng: r.longitude }}
            onClick={() =>
              setSelectedId(selectedId === r.id ? null : r.id)
            }
          />
          {selectedId === r.id && (
            <InfoWindow
              position={{ lat: r.latitude, lng: r.longitude }}
              onCloseClick={() => setSelectedId(null)}
              onClose={() => setSelectedId(null)}
            >
              <div style={{ padding: 4, minWidth: 160 }}>
                <strong>{r.user_display_name || r.user_email}</strong>
                <br />
                {new Date(
                  r.reported_at_server ?? r.reported_at
                ).toLocaleString()}
                {r.accuracy != null && (
                  <> · Accuracy ±{Math.round(r.accuracy)} m</>
                )}
                {r.battery_percent != null && (
                  <> · Battery {r.battery_percent}%</>
                )}
              </div>
            </InfoWindow>
          )}
        </React.Fragment>
      ))}
    </Map>
  );
}

/** True when Google Maps API key is set (non-empty string). */
export function hasGoogleMapsApiKey(): boolean {
  const key =
    typeof process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY === "string"
      ? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      : "";
  return key.length > 0;
}

export function TrackingMap(props: TrackingMapProps) {
  const apiKey =
    typeof process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY === "string"
      ? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.trim()
      : "";

  if (!apiKey) {
    return <TrackingMapOSM {...props} />;
  }

  return (
    <APIProvider apiKey={apiKey}>
      <TrackingMapInner {...props} />
    </APIProvider>
  );
}
