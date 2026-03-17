"use client";

import React, { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import type { Farm } from "@/lib/types";

const MAP_HEIGHT = 420;

const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const currentIcon = L.divIcon({
  className: "farms-map-current-marker",
  html: `<div style="
    width: 28px; height: 28px; border-radius: 50%;
    background: #1B8F3A; border: 3px solid white; box-shadow: 0 1px 4px rgba(0,0,0,0.4);
  "></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function parseCoord(v: string | number | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : null;
}

function MapFitBounds({ farms }: { farms: Farm[] }) {
  const map = useMap();
  useEffect(() => {
    if (farms.length === 0) return;
    const valid = farms.filter(
      (f) => parseCoord(f.latitude) != null && parseCoord(f.longitude) != null
    );
    if (valid.length === 0) return;
    if (valid.length === 1) {
      map.setView([Number(valid[0].latitude), Number(valid[0].longitude)], 14);
      return;
    }
    const bounds = L.latLngBounds(
      valid.map((f) => [Number(f.latitude), Number(f.longitude)] as L.LatLngTuple)
    );
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 14 });
  }, [map, farms]);
  return null;
}

export type FarmsMapViewProps = {
  farms: Farm[];
  currentFarmId?: string | null;
  /** e.g. "Farm" or "Outlet" for popup label */
  locationLabel?: string;
};

export function FarmsMapView({
  farms,
  currentFarmId,
  locationLabel = "Farm",
}: FarmsMapViewProps) {
  const validFarms = useMemo(
    () =>
      farms.filter(
        (f) => parseCoord(f.latitude) != null && parseCoord(f.longitude) != null
      ),
    [farms]
  );

  const center: [number, number] = useMemo(() => {
    const current = currentFarmId
      ? validFarms.find((f) => f.id === currentFarmId)
      : null;
    const first = validFarms[0];
    const f = current ?? first;
    if (f)
      return [Number(f.latitude), Number(f.longitude)];
    return [-1.292066, 36.821946];
  }, [validFarms, currentFarmId]);

  if (validFarms.length === 0) {
    return (
      <div
        style={{
          height: MAP_HEIGHT,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f1f5f1",
          borderRadius: 8,
          color: "#6b7280",
        }}
      >
        No locations with coordinates to show on map.
      </div>
    );
  }

  return (
    <div
      style={{
        height: MAP_HEIGHT,
        width: "100%",
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid #e5e7eb",
      }}
    >
      <MapContainer
        center={center}
        zoom={12}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapFitBounds farms={validFarms} />
        {validFarms.map((f) => {
          const lat = Number(f.latitude);
          const lng = Number(f.longitude);
          const isCurrent = f.id === currentFarmId;
          return (
            <Marker
              key={f.id}
              position={[lat, lng]}
              icon={isCurrent ? currentIcon : defaultIcon}
            >
              <Popup>
                <div style={{ padding: 4, minWidth: 140 }}>
                  {isCurrent && (
                    <strong style={{ color: "#1B8F3A" }}>Current {locationLabel} · </strong>
                  )}
                  <strong>{f.village || "—"}</strong>
                  {(f.sub_county || f.county) && (
                    <>
                      <br />
                      <span style={{ fontSize: 12, color: "#6b7280" }}>
                        {[f.sub_county, f.county].filter(Boolean).join(", ")}
                      </span>
                    </>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
