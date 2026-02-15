"use client";

import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import MapAutoFit from "@/components/maps/map-auto-fit";
import { publicEnv } from "@/lib/public-env";
import type { VehicleCurrentLocation } from "@/lib/types";

interface FleetMapProps {
  vehicles: VehicleCurrentLocation[];
  selectedPlate: string | null;
  onSelectPlate: (plate: string) => void;
}

function getCenter(vehicles: VehicleCurrentLocation[]): [number, number] {
  const first = vehicles.find((vehicle) => vehicle.lat !== null && vehicle.lon !== null);
  if (!first || first.lat === null || first.lon === null) return [24.7136, 46.6753];
  return [first.lat, first.lon];
}

export default function FleetMap({ vehicles, selectedPlate, onSelectPlate }: FleetMapProps) {
  const centered = getCenter(vehicles);
  const markerPoints: [number, number][] = vehicles
    .filter((vehicle) => vehicle.lat !== null && vehicle.lon !== null)
    .map((vehicle) => [vehicle.lat as number, vehicle.lon as number]);
  const selectedVehicle = vehicles.find((vehicle) => vehicle.plateNumber === selectedPlate) ?? null;
  const selectedPoint: [number, number] | null =
    selectedVehicle && selectedVehicle.lat != null && selectedVehicle.lon != null
      ? [selectedVehicle.lat, selectedVehicle.lon]
      : null;

  const focusPoints = selectedPoint ? [selectedPoint] : markerPoints;

  return (
    <div className="mapContainer panel">
      <MapContainer center={centered} zoom={6} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url={publicEnv.osmTileUrl}
        />
        <MapAutoFit points={focusPoints} singleZoom={13} />
        {vehicles.map((vehicle) => {
          if (vehicle.lat === null || vehicle.lon === null) return null;
          const isSelected = vehicle.plateNumber === selectedPlate;
          return (
            <CircleMarker
              key={vehicle.plateNumber}
              center={[vehicle.lat, vehicle.lon]}
              radius={isSelected ? 10 : 7}
              pathOptions={{
                color: isSelected ? "#0f766e" : "#194b8d",
                fillColor: isSelected ? "#14b8a6" : "#2d6cdf",
                fillOpacity: 0.85
              }}
              eventHandlers={{
                click: () => onSelectPlate(vehicle.plateNumber)
              }}
            >
              <Popup>
                <strong>{vehicle.plateNumber}</strong>
                <br />
                {vehicle.displayName || "No display name"}
                <br />
                {vehicle.road || "Road unknown"}
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
