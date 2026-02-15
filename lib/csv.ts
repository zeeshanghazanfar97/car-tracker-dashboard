import type { TripReport } from "@/lib/types";

function escapeCsv(value: string | number | null): string {
  if (value === null) return "";
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export function tripsToCsv(trips: TripReport[]): string {
  const headers = [
    "plate_number",
    "display_name",
    "start_time",
    "end_time",
    "duration_sec",
    "idle_sec",
    "moving_sec",
    "distance_km",
    "avg_speed_kmh",
    "max_speed_kmh",
    "start_lat",
    "start_lon",
    "end_lat",
    "end_lon",
    "has_time_anomaly"
  ];

  const rows = trips.map((trip) => [
    trip.plateNumber,
    trip.displayName,
    trip.startTime,
    trip.endTime,
    trip.durationSec,
    trip.idleSec,
    trip.movingSec,
    trip.distanceKm,
    trip.avgSpeedKmh,
    trip.maxSpeedKmh,
    trip.startLat,
    trip.startLon,
    trip.endLat,
    trip.endLon,
    trip.hasTimeAnomaly
  ]);

  return [
    headers.join(","),
    ...rows.map((row) => row.map((value) => escapeCsv(value as string | number | null)).join(","))
  ].join("\n");
}
