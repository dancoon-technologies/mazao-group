"use client";

import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import type { LocationReport } from "@/lib/types";

const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

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
};

export function TrackingMap({ reports, center, zoom }: TrackingMapProps) {
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
      {reports.map((r) => (
        <Marker
          key={r.id}
          position={[r.latitude, r.longitude]}
          icon={defaultIcon}
        >
          <Popup>
            <strong>{r.user_display_name || r.user_email}</strong>
            <br />
            {new Date(r.reported_at).toLocaleString()}
            {r.battery_percent != null && (
              <> · Battery {r.battery_percent}%</>
            )}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
