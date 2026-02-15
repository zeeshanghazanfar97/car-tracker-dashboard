import { NextRequest, NextResponse } from "next/server";
import { TtlCache } from "@/lib/cache";
import { env } from "@/lib/env";
import { badRequest, internalError } from "@/lib/http";
import { getCurrentVehicles } from "@/lib/queries";

export const dynamic = "force-dynamic";

const CACHE = new TtlCache<Awaited<ReturnType<typeof getCurrentVehicles>>>(
  Math.max(5000, env.pollIntervalSec * 1000)
);

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const plate = request.nextUrl.searchParams.get("plate")?.trim() || undefined;
    const activeWithinRaw = request.nextUrl.searchParams.get("activeWithinMinutes");
    const activeWithinMinutes = activeWithinRaw ? Number(activeWithinRaw) : undefined;

    if (
      activeWithinRaw &&
      (!Number.isFinite(activeWithinMinutes) || Number(activeWithinMinutes) <= 0)
    ) {
      return badRequest("activeWithinMinutes must be a positive number");
    }

    const cacheKey = JSON.stringify({ plate: plate ?? null, activeWithinMinutes: activeWithinMinutes ?? null });
    const cached = CACHE.get(cacheKey);
    if (cached) {
      return NextResponse.json({
        vehicles: cached,
        cached: true,
        pollIntervalSec: env.pollIntervalSec,
        fetchedAt: new Date().toISOString()
      });
    }

    const vehicles = await getCurrentVehicles({ plate, activeWithinMinutes });
    CACHE.set(cacheKey, vehicles);

    return NextResponse.json({
      vehicles,
      cached: false,
      pollIntervalSec: env.pollIntervalSec,
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("GET /api/vehicles/current error", error);
    return internalError("Failed to fetch current vehicle positions");
  }
}
