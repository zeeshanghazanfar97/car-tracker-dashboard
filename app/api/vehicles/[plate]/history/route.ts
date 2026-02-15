import { NextRequest, NextResponse } from "next/server";
import { badRequest, internalError } from "@/lib/http";
import { toGeoJsonLine } from "@/lib/geo";
import { snapRouteToRoads } from "@/lib/osrm";
import { getVehicleHistorySegments } from "@/lib/queries";
import { parseDateRange } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ plate: string }> }
): Promise<NextResponse> {
  try {
    const { plate } = await params;
    if (!plate) return badRequest("plate parameter is required");

    const fromRaw = request.nextUrl.searchParams.get("from");
    const toRaw = request.nextUrl.searchParams.get("to");
    const shouldSnap = (request.nextUrl.searchParams.get("snap") ?? "true") !== "false";

    const range = parseDateRange(fromRaw, toRaw);
    const segments = await getVehicleHistorySegments({
      plate,
      fromIso: range.from.toISOString(),
      toIso: range.to.toISOString()
    });

    const payload = segments.map((segment) => ({
      id: segment.id,
      plateNumber: segment.plate_number,
      displayName: segment.display_name,
      speedKmh: segment.speed_kmh,
      heading: segment.heading,
      startTime: segment.effective_start,
      endTime: segment.effective_end,
      durationSec: segment.duration_sec,
      lat: segment.point?.lat ?? null,
      lon: segment.point?.lon ?? null,
      locationWarning: segment.point ? null : "location_parse_failed_or_missing",
      road: segment.road,
      suburb: segment.suburb,
      city: segment.city,
      state: segment.state,
      country: segment.country,
      hasTimeAnomaly: segment.has_time_anomaly
    }));

    const points = payload
      .filter((item) => item.lat !== null && item.lon !== null)
      .map((item) => ({ lat: item.lat as number, lon: item.lon as number, time: item.startTime }));

    const routePoints = points.map((point) => ({ lat: point.lat, lon: point.lon }));
    const rawRoute = toGeoJsonLine(routePoints);

    let snappedRoute: GeoJSON.Feature<GeoJSON.LineString> | null = null;
    let snapError: string | null = null;

    if (shouldSnap) {
      try {
        snappedRoute = await snapRouteToRoads(routePoints);
      } catch (error) {
        snapError = error instanceof Error ? error.message : "Unknown OSRM error";
      }
    }

    return NextResponse.json({
      plate,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      count: payload.length,
      points,
      snapRequested: shouldSnap,
      snapApplied: Boolean(snappedRoute),
      snapError,
      route: {
        raw: rawRoute,
        snapped: snappedRoute
      },
      segments: payload
    });
  } catch (error) {
    console.error("GET /api/vehicles/[plate]/history error", error);
    if (error instanceof Error && error.message.toLowerCase().includes("date range")) {
      return badRequest(error.message);
    }
    return internalError("Failed to fetch vehicle history");
  }
}
