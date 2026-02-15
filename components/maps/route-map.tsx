"use client";

import { CircleMarker, GeoJSON, MapContainer, TileLayer } from "react-leaflet";
import MapAutoFit from "@/components/maps/map-auto-fit";
import { publicEnv } from "@/lib/public-env";

interface RouteMapProps {
  points: Array<{ lat: number; lon: number }>;
  raw: GeoJSON.Feature<GeoJSON.LineString> | null;
  snapped: GeoJSON.Feature<GeoJSON.LineString> | null;
}

function getCenter(points: Array<{ lat: number; lon: number }>): [number, number] {
  if (points.length === 0) return [24.7136, 46.6753];
  return [points[0].lat, points[0].lon];
}

export default function RouteMap({ points, raw, snapped }: RouteMapProps) {
  const center = getCenter(points);
  const start = points[0] ?? null;
  const end = points[points.length - 1] ?? null;

  const snappedPoints: [number, number][] =
    snapped?.geometry.coordinates.map((coord) => [coord[1], coord[0]]) ?? [];
  const rawPoints: [number, number][] = raw?.geometry.coordinates.map((coord) => [coord[1], coord[0]]) ?? [];
  const fallbackPoints: [number, number][] = points.map((point) => [point.lat, point.lon]);
  const focusPoints = snappedPoints.length > 0 ? snappedPoints : rawPoints.length > 0 ? rawPoints : fallbackPoints;

  return (
    <div className="mapContainer panel">
      <MapContainer center={center} zoom={11} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url={publicEnv.osmTileUrl}
        />
        <MapAutoFit points={focusPoints} singleZoom={15} />

        {!snapped && raw && <GeoJSON data={raw} style={{ color: "#f59e0b", weight: 4, opacity: 0.85 }} />}
        {snapped && <GeoJSON data={snapped} style={{ color: "#0f766e", weight: 5, opacity: 0.95 }} />}

        {start && (
          <CircleMarker
            center={[start.lat, start.lon]}
            radius={8}
            pathOptions={{ color: "#065f46", fillColor: "#34d399", fillOpacity: 1 }}
          />
        )}
        {end && (
          <CircleMarker
            center={[end.lat, end.lon]}
            radius={8}
            pathOptions={{ color: "#7f1d1d", fillColor: "#ef4444", fillOpacity: 1 }}
          />
        )}
      </MapContainer>
    </div>
  );
}
