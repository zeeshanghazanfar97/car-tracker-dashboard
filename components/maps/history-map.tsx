"use client";

import { CircleMarker, GeoJSON, MapContainer, Popup, TileLayer } from "react-leaflet";
import MapAutoFit from "@/components/maps/map-auto-fit";
import { publicEnv } from "@/lib/public-env";

interface HistoryMapProps {
  points: Array<{ lat: number; lon: number; time: string }>;
  raw: GeoJSON.Feature<GeoJSON.LineString> | null;
  snapped: GeoJSON.Feature<GeoJSON.LineString> | null;
}

function computeCenter(points: Array<{ lat: number; lon: number }>): [number, number] {
  if (points.length === 0) return [24.7136, 46.6753];
  return [points[0].lat, points[0].lon];
}

export default function HistoryMap({ points, raw, snapped }: HistoryMapProps) {
  const center = computeCenter(points);
  const positions: [number, number][] = points.map((p) => [p.lat, p.lon]);
  const start = points[0] ?? null;
  const end = points[points.length - 1] ?? null;
  const snappedPositions: [number, number][] =
    snapped?.geometry.coordinates.map((coord) => [coord[1], coord[0]]) ?? [];
  const rawPositions: [number, number][] = raw?.geometry.coordinates.map((coord) => [coord[1], coord[0]]) ?? [];
  const focusPoints =
    snappedPositions.length > 0 ? snappedPositions : rawPositions.length > 0 ? rawPositions : positions;

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
            pathOptions={{ color: "#065f46", fillColor: "#34d399", fillOpacity: 0.9 }}
          >
            <Popup>
              <strong>Start</strong>
              <br />
              {new Date(start.time).toLocaleString()}
            </Popup>
          </CircleMarker>
        )}

        {end && (
          <CircleMarker
            center={[end.lat, end.lon]}
            radius={8}
            pathOptions={{ color: "#991b1b", fillColor: "#ef4444", fillOpacity: 0.9 }}
          >
            <Popup>
              <strong>End</strong>
              <br />
              {new Date(end.time).toLocaleString()}
            </Popup>
          </CircleMarker>
        )}
      </MapContainer>
    </div>
  );
}
