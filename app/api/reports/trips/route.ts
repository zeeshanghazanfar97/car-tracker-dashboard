import { NextRequest, NextResponse } from "next/server";
import { badRequest, internalError, parsePlateList } from "@/lib/http";
import { buildTripsReport } from "@/lib/reporting";
import { parseDateRange } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const fromRaw = request.nextUrl.searchParams.get("from");
    const toRaw = request.nextUrl.searchParams.get("to");
    const range = parseDateRange(fromRaw, toRaw);

    const plates = parsePlateList(request.nextUrl.searchParams.get("plate"));
    const trips = await buildTripsReport({
      plates,
      fromIso: range.from.toISOString(),
      toIso: range.to.toISOString()
    });

    return NextResponse.json({
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      count: trips.length,
      trips: trips.map((trip) => ({
        plateNumber: trip.plateNumber,
        displayName: trip.displayName,
        startTime: trip.startTime,
        endTime: trip.endTime,
        durationSec: trip.durationSec,
        idleSec: trip.idleSec,
        movingSec: trip.movingSec,
        distanceKm: trip.distanceKm,
        avgSpeedKmh: trip.avgSpeedKmh,
        maxSpeedKmh: trip.maxSpeedKmh,
        startLat: trip.startLat,
        startLon: trip.startLon,
        endLat: trip.endLat,
        endLon: trip.endLon,
        hasTimeAnomaly: trip.hasTimeAnomaly
      }))
    });
  } catch (error) {
    console.error("GET /api/reports/trips error", error);
    if (error instanceof Error && error.message.toLowerCase().includes("date range")) {
      return badRequest(error.message);
    }
    return internalError("Failed to build trips report");
  }
}
