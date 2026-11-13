"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, LayersControl, Polyline, CircleMarker, Tooltip, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { RouteGeoJSON } from "@/lib/types";

export type { RouteGeoJSON };

// Refits whenever the route itself is replaced (e.g. after a GPX upload), not on other re-renders.
function FitBounds({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length > 0) {
      const latLngs = coords.map(([lng, lat]) => [lat, lng] as [number, number]);
      map.fitBounds(L.latLngBounds(latLngs), { padding: [24, 24] });
    }
  }, [map, coords]);
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
  baseLayer = "osm",
  height = 320,
}: {
  geojson: RouteGeoJSON;
  onMapClick?: (lat: number, lng: number) => void;
  clickMarker?: [number, number] | null; // [lat, lng]
  checkpointMarkers?: { lat: number; lng: number; label?: string }[];
  baseLayer?: "osm" | "topo"; // initially selected; both stay switchable
  height?: number;
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
        height: `${height}px`,
        width: "100%",
        borderRadius: "8px",
        zIndex: 0,
        cursor: onMapClick ? "crosshair" : undefined,
      }}
    >
      <LayersControl position="topright">
        <LayersControl.BaseLayer name="OpenStreetMap" checked={baseLayer === "osm"}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="OpenTopoMap (terrain)" checked={baseLayer === "topo"}>
          <TileLayer
            url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
            maxZoom={17}
            attribution='Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
          />
        </LayersControl.BaseLayer>
      </LayersControl>
      <Polyline positions={positions} pathOptions={{ color: "#2563eb", weight: 3, opacity: 0.85 }} />
      {start && (
        <CircleMarker
          center={start}
          radius={7}
          pathOptions={{ fillColor: "#16a34a", color: "#fff", weight: 2, fillOpacity: 1 }}
        >
          <Tooltip>Start</Tooltip>
        </CircleMarker>
      )}
      {end && (
        <CircleMarker
          center={end}
          radius={7}
          pathOptions={{ fillColor: "#dc2626", color: "#fff", weight: 2, fillOpacity: 1 }}
        >
          <Tooltip>End</Tooltip>
        </CircleMarker>
      )}
      {/* Existing checkpoints */}
      {checkpointMarkers?.map((cp, i) => (
        <CircleMarker
          key={i}
          center={[cp.lat, cp.lng]}
          radius={6}
          pathOptions={{ fillColor: "#f59e0b", color: "#fff", weight: 2, fillOpacity: 1 }}
        >
          {cp.label && <Tooltip>{cp.label}</Tooltip>}
        </CircleMarker>
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
