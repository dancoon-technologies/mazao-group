"use client";

import { useCallback, useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";

const DEFAULT_CENTER: [number, number] = [-1.292066, 36.821946];
const DEFAULT_ZOOM = 10;

/** Map container height in pixels (single source of truth). */
const MAP_HEIGHT = 520;

// Single marker icon instance (Leaflet can misbehave if recreated every render)
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function MapClickHandler({
  onSelect,
}: {
  onSelect: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      onSelect(lat, lng);
    },
  });
  return null;
}

function MapLifecycle({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 100);
    const t2 = setTimeout(() => map.invalidateSize(), 350);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [map]);
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center[0], center[1], zoom]);
  return null;
}

type MapPickerProps = {
  latitude: number | null;
  longitude: number | null;
  onSelect: (lat: number, lng: number) => void;
  className?: string;
};

export function MapPicker({
  latitude,
  longitude,
  onSelect,
  className = "",
}: MapPickerProps) {
  const [locationError, setLocationError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Delay map creation until container is fully laid out (fixes fragmented tiles)
  useEffect(() => {
    const t = setTimeout(() => setMapReady(true), 250);
    return () => clearTimeout(t);
  }, []);

  const handleUseLocation = useCallback(() => {
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        onSelect(lat, lng);
      },
      () => setLocationError("Could not get your location.")
    );
  }, [onSelect]);

  const hasPosition =
    latitude != null &&
    longitude != null &&
    !Number.isNaN(latitude) &&
    !Number.isNaN(longitude);
  const center: [number, number] = hasPosition
    ? [latitude, longitude]
    : DEFAULT_CENTER;
  const zoom = hasPosition ? 14 : DEFAULT_ZOOM;

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-stone-600">
          Tap the map to set the farmer&apos;s location
        </p>
        <button
          type="button"
          onClick={handleUseLocation}
          className="shrink-0 rounded-lg border border-stone-300 bg-stone-50 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-100"
        >
          Use my location
        </button>
      </div>
      {locationError && (
        <p className="mt-1 text-sm text-red-600">
          {locationError}
        </p>
      )}
      <div
        className="relative mt-2 w-full overflow-hidden rounded-lg border border-stone-200"
        style={{ height: MAP_HEIGHT, minHeight: MAP_HEIGHT }}
      >
        {!mapReady && (
          <div
            className="flex items-center justify-center text-stone-500"
            style={{ height: MAP_HEIGHT, minHeight: MAP_HEIGHT }}
          >
            Loading map…
          </div>
        )}
        {mapReady && (
          <MapContainer
            center={center}
            zoom={zoom}
            className="[&_.leaflet-interactive]:cursor-crosshair h-full w-full"
            style={{ height: MAP_HEIGHT, minHeight: MAP_HEIGHT, width: "100%", zIndex: 0 }}
            scrollWheelZoom
          >
            <MapLifecycle center={center} zoom={zoom} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapClickHandler onSelect={onSelect} />
            {hasPosition && (
              <Marker
                position={[latitude, longitude]}
                icon={defaultIcon}
              />
            )}
          </MapContainer>
        )}
      </div>
    </div>
  );
}
