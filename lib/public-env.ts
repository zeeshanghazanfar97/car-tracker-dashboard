const DEFAULT_POLL_INTERVAL_SEC = 10;
const DEFAULT_ACTIVE_POLL_INTERVAL_SEC = 3;
const DEFAULT_BACKGROUND_POLL_INTERVAL_SEC = 15;
const DEFAULT_SESSION_REFRESH_INTERVAL_MIN = 720;
const DEFAULT_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const publicEnv = {
  pollIntervalSec: parseNumber(process.env.NEXT_PUBLIC_POLL_INTERVAL_SEC, DEFAULT_POLL_INTERVAL_SEC),
  activePollIntervalSec: parseNumber(
    process.env.NEXT_PUBLIC_POLL_INTERVAL_ACTIVE_SEC,
    parseNumber(process.env.NEXT_PUBLIC_POLL_INTERVAL_SEC, DEFAULT_ACTIVE_POLL_INTERVAL_SEC)
  ),
  backgroundPollIntervalSec: parseNumber(
    process.env.NEXT_PUBLIC_POLL_INTERVAL_BACKGROUND_SEC,
    DEFAULT_BACKGROUND_POLL_INTERVAL_SEC
  ),
  sessionRefreshIntervalMin: parseNumber(
    process.env.NEXT_PUBLIC_SESSION_REFRESH_INTERVAL_MIN,
    DEFAULT_SESSION_REFRESH_INTERVAL_MIN
  ),
  osmTileUrl: process.env.NEXT_PUBLIC_OSM_TILE_URL ?? DEFAULT_TILE_URL
};
