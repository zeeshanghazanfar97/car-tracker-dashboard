const DEFAULT_POLL_INTERVAL_SEC = 10;
const DEFAULT_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const publicEnv = {
  pollIntervalSec: parseNumber(process.env.NEXT_PUBLIC_POLL_INTERVAL_SEC, DEFAULT_POLL_INTERVAL_SEC),
  osmTileUrl: process.env.NEXT_PUBLIC_OSM_TILE_URL ?? DEFAULT_TILE_URL
};
