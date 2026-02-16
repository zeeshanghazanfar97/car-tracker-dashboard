const DEFAULTS = {
  osrmBaseUrl: "http://osrm:5000",
  pollIntervalSec: 10,
  currentVehiclesCacheTtlMs: 1000,
  moveDistanceM: 50,
  moveSpeedKmh: 5,
  stopMinutes: 5,
  osmTileUrl: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
};

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const env = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  osrmBaseUrl: process.env.OSRM_BASE_URL ?? DEFAULTS.osrmBaseUrl,
  pollIntervalSec: parseNumber(process.env.POLL_INTERVAL_SEC, DEFAULTS.pollIntervalSec),
  currentVehiclesCacheTtlMs: parseNumber(
    process.env.CURRENT_VEHICLES_CACHE_TTL_MS,
    DEFAULTS.currentVehiclesCacheTtlMs
  ),
  moveDistanceM: parseNumber(process.env.TRIP_MOVE_DISTANCE_M, DEFAULTS.moveDistanceM),
  moveSpeedKmh: parseNumber(process.env.TRIP_MOVE_SPEED_KMH, DEFAULTS.moveSpeedKmh),
  stopMinutes: parseNumber(process.env.TRIP_STOP_MINUTES, DEFAULTS.stopMinutes),
  osmTileUrl: process.env.NEXT_PUBLIC_OSM_TILE_URL ?? DEFAULTS.osmTileUrl,
  publicPollIntervalSec: parseNumber(
    process.env.NEXT_PUBLIC_POLL_INTERVAL_SEC,
    DEFAULTS.pollIntervalSec
  )
};

export function assertServerEnv(): void {
  if (!env.databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }
}
