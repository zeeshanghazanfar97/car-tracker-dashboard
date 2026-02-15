import { getFleetSegmentsByRange, getVehicleHistorySegments } from "@/lib/queries";
import { inferTrips, inferTripsForPlate } from "@/lib/trips";
import { toGeoJsonLine } from "@/lib/geo";
import type { TripReport } from "@/lib/types";

export async function buildTripsReport(params: {
  plates?: string[];
  fromIso: string;
  toIso: string;
}): Promise<TripReport[]> {
  const rows = await getFleetSegmentsByRange(params);
  return inferTrips(rows);
}

export async function buildVehicleTrips(params: {
  plate: string;
  fromIso: string;
  toIso: string;
}): Promise<TripReport[]> {
  const rows = await getVehicleHistorySegments(params);
  return inferTripsForPlate(rows);
}

export async function buildRouteForRange(params: {
  plate: string;
  fromIso: string;
  toIso: string;
}): Promise<{
  points: Array<{ lat: number; lon: number }>;
  line: GeoJSON.Feature<GeoJSON.LineString> | null;
  trips: TripReport[];
}> {
  const rows = await getVehicleHistorySegments(params);
  const points = rows
    .map((row) => row.point)
    .filter((point): point is NonNullable<typeof point> => Boolean(point));

  return {
    points,
    line: toGeoJsonLine(points),
    trips: inferTripsForPlate(rows)
  };
}
