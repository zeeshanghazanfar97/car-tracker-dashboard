import { NextRequest, NextResponse } from "next/server";
import { badRequest, internalError } from "@/lib/http";
import { snapRouteToRoads } from "@/lib/osrm";
import { buildRouteForRange } from "@/lib/reporting";
import { parseDateRange } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const plate = request.nextUrl.searchParams.get("plate")?.trim();
    if (!plate) return badRequest("plate is required");

    const range = parseDateRange(
      request.nextUrl.searchParams.get("from"),
      request.nextUrl.searchParams.get("to")
    );

    const shouldSnap = (request.nextUrl.searchParams.get("snap") ?? "true") !== "false";

    const routeData = await buildRouteForRange({
      plate,
      fromIso: range.from.toISOString(),
      toIso: range.to.toISOString()
    });

    let snapped: GeoJSON.Feature<GeoJSON.LineString> | null = null;
    let snapError: string | null = null;

    if (shouldSnap) {
      try {
        snapped = await snapRouteToRoads(routeData.points);
      } catch (error) {
        snapError = error instanceof Error ? error.message : "Unknown OSRM error";
      }
    }

    return NextResponse.json({
      plate,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      snapRequested: shouldSnap,
      snapApplied: Boolean(snapped),
      snapError,
      tripCount: routeData.trips.length,
      route: {
        raw: routeData.line,
        snapped
      },
      points: routeData.points,
      trips: routeData.trips.map((trip) => ({
        plateNumber: trip.plateNumber,
        startTime: trip.startTime,
        endTime: trip.endTime,
        distanceKm: trip.distanceKm,
        durationSec: trip.durationSec,
        idleSec: trip.idleSec,
        movingSec: trip.movingSec,
        avgSpeedKmh: trip.avgSpeedKmh,
        maxSpeedKmh: trip.maxSpeedKmh
      }))
    });
  } catch (error) {
    console.error("GET /api/reports/trips/route error", error);
    if (error instanceof Error && error.message.toLowerCase().includes("date range")) {
      return badRequest(error.message);
    }
    return internalError("Failed to build trip route");
  }
}
