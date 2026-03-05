"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type RouteGeoJSON = {
  type: string;
  coordinates: [number, number][]; // [lng, lat] — GeoJSON order
};

function FitBounds({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length > 0) {
      const latLngs = coords.map(([lng, lat]) => [lat, lng] as [number, number]);
      map.fitBounds(L.latLngBounds(latLngs), { padding: [24, 24] });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function ClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function RouteMap({
  geojson,
  onMapClick,
  clickMarker,
  checkpointMarkers,
}: {
  geojson: RouteGeoJSON;
  onMapClick?: (lat: number, lng: number) => void;
  clickMarker?: [number, number] | null; // [lat, lng]
  checkpointMarkers?: { lat: number; lng: number }[];
}) {
  // GeoJSON is [lng, lat]; Leaflet expects [lat, lng]
  const positions: [number, number][] = geojson.coordinates.map(([lng, lat]) => [lat, lng]);
  const center = positions[Math.floor(positions.length / 2)] ?? ([42.3, 43.4] as [number, number]);
  const start = positions[0];
  const end = positions[positions.length - 1];

  return (
    <MapContainer
      center={center}
      zoom={12}
      scrollWheelZoom
      style={{
        height: "320px",
        width: "100%",
        borderRadius: "8px",
        zIndex: 0,
        cursor: onMapClick ? "crosshair" : undefined,
      }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <Polyline positions={positions} pathOptions={{ color: "#2563eb", weight: 3, opacity: 0.85 }} />
      {start && (
        <CircleMarker
          center={start}
          radius={7}
          pathOptions={{ fillColor: "#16a34a", color: "#fff", weight: 2, fillOpacity: 1 }}
        />
      )}
      {end && (
        <CircleMarker
          center={end}
          radius={7}
          pathOptions={{ fillColor: "#dc2626", color: "#fff", weight: 2, fillOpacity: 1 }}
        />
      )}
      {/* Existing checkpoints */}
      {checkpointMarkers?.map((cp, i) => (
        <CircleMarker
          key={i}
          center={[cp.lat, cp.lng]}
          radius={6}
          pathOptions={{ fillColor: "#f59e0b", color: "#fff", weight: 2, fillOpacity: 1 }}
        />
      ))}
      {/* Placement pin for new checkpoint */}
      {clickMarker && (
        <CircleMarker
          center={clickMarker}
          radius={8}
          pathOptions={{ fillColor: "#7c3aed", color: "#fff", weight: 2, fillOpacity: 1 }}
        />
      )}
      {onMapClick && <ClickHandler onMapClick={onMapClick} />}
      <FitBounds coords={geojson.coordinates} />
    </MapContainer>
  );
}
