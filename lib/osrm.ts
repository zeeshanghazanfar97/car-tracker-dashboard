import { TtlCache } from "@/lib/cache";
import { env } from "@/lib/env";
import type { GeoPoint } from "@/lib/types";

const CACHE = new TtlCache<GeoJSON.Feature<GeoJSON.LineString>>(60 * 60 * 1000);
const COORD_PRECISION = 6;
const REQUEST_TIMEOUT_MS = 5000;

function isValidPoint(point: GeoPoint): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lon) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    point.lon >= -180 &&
    point.lon <= 180
  );
}

function normalizePoints(points: GeoPoint[]): GeoPoint[] {
  const normalized: GeoPoint[] = [];
  let lastKey: string | null = null;

  for (const point of points) {
    if (!isValidPoint(point)) continue;

    const lat = Number(point.lat.toFixed(COORD_PRECISION));
    const lon = Number(point.lon.toFixed(COORD_PRECISION));
    const key = `${lat},${lon}`;

    if (key === lastKey) continue;

    normalized.push({ lat, lon });
    lastKey = key;
  }

  return normalized;
}

function pairCoordString(a: GeoPoint, b: GeoPoint): string {
  return `${a.lon.toFixed(COORD_PRECISION)},${a.lat.toFixed(COORD_PRECISION)};${b.lon.toFixed(COORD_PRECISION)},${b.lat.toFixed(COORD_PRECISION)}`;
}

function appendCoordinates(target: Array<[number, number]>, coordinates: Array<[number, number]>): void {
  if (coordinates.length === 0) return;

  if (target.length === 0) {
    target.push(...coordinates);
    return;
  }

  const [lastLon, lastLat] = target[target.length - 1];
  const [firstLon, firstLat] = coordinates[0];
  const isDuplicate = lastLon === firstLon && lastLat === firstLat;

  target.push(...(isDuplicate ? coordinates.slice(1) : coordinates));
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      signal: controller.signal,
      cache: "no-store"
    });
  } finally {
    clearTimeout(timeout);
  }
}

function parseOsrmErrorBody(raw: string): { detail: string; data: unknown } {
  try {
    const data = JSON.parse(raw) as { code?: string; message?: string };
    const detail = data.message ?? data.code ?? raw.slice(0, 200);
    return { detail, data };
  } catch {
    return { detail: raw.slice(0, 200), data: null };
  }
}

async function fetchMatchPair(a: GeoPoint, b: GeoPoint): Promise<Array<[number, number]>> {
  const coords = pairCoordString(a, b);
  const url = `${env.osrmBaseUrl}/match/v1/driving/${coords}?geometries=geojson&overview=full&tidy=true&gaps=split`;

  const response = await fetchWithTimeout(url);
  const raw = await response.text();
  const parsed = parseOsrmErrorBody(raw);

  if (!response.ok) {
    throw new Error(`OSRM match error: ${response.status}${parsed.detail ? ` - ${parsed.detail}` : ""}`);
  }

  const data = parsed.data as
    | {
        code?: string;
        message?: string;
        matchings?: Array<{ geometry?: { coordinates?: Array<[number, number]> } }>;
      }
    | null;

  if (!data || (data.code && data.code !== "Ok")) {
    throw new Error(`OSRM match error: ${data?.code ?? "InvalidResponse"}${data?.message ? ` - ${data.message}` : ""}`);
  }

  const geometry = data.matchings?.[0]?.geometry?.coordinates;
  if (!geometry || geometry.length < 2) {
    throw new Error("OSRM match returned empty geometry");
  }

  return geometry;
}

async function fetchRoutePair(a: GeoPoint, b: GeoPoint): Promise<Array<[number, number]>> {
  const coords = pairCoordString(a, b);
  const url = `${env.osrmBaseUrl}/route/v1/driving/${coords}?geometries=geojson&overview=full&steps=false`;

  const response = await fetchWithTimeout(url);
  const raw = await response.text();
  const parsed = parseOsrmErrorBody(raw);

  if (!response.ok) {
    throw new Error(`OSRM route error: ${response.status}${parsed.detail ? ` - ${parsed.detail}` : ""}`);
  }

  const data = parsed.data as
    | {
        code?: string;
        message?: string;
        routes?: Array<{ geometry?: { coordinates?: Array<[number, number]> } }>;
      }
    | null;

  if (!data || (data.code && data.code !== "Ok")) {
    throw new Error(`OSRM route error: ${data?.code ?? "InvalidResponse"}${data?.message ? ` - ${data.message}` : ""}`);
  }

  const geometry = data.routes?.[0]?.geometry?.coordinates;
  if (!geometry || geometry.length < 2) {
    throw new Error("OSRM route returned empty geometry");
  }

  return geometry;
}

function rawSegment(a: GeoPoint, b: GeoPoint): Array<[number, number]> {
  return [
    [a.lon, a.lat],
    [b.lon, b.lat]
  ];
}

export async function snapRouteToRoads(points: GeoPoint[]): Promise<GeoJSON.Feature<GeoJSON.LineString> | null> {
  const validPoints = normalizePoints(points);
  if (validPoints.length < 2) return null;

  const key = `match-v2|${validPoints
    .map((point) => `${point.lat.toFixed(COORD_PRECISION)},${point.lon.toFixed(COORD_PRECISION)}`)
    .join(";")}`;

  const cached = CACHE.get(key);
  if (cached) return cached;

  const stitched: Array<[number, number]> = [];
  let hadFailures = false;

  for (let index = 0; index < validPoints.length - 1; index += 1) {
    const start = validPoints[index];
    const end = validPoints[index + 1];

    if (start.lat === end.lat && start.lon === end.lon) continue;

    let segment: Array<[number, number]> = rawSegment(start, end);

    try {
      segment = await fetchMatchPair(start, end);
    } catch (matchError) {
      try {
        segment = await fetchRoutePair(start, end);
      } catch (routeError) {
        hadFailures = true;
        const matchMessage = matchError instanceof Error ? matchError.message : String(matchError);
        const routeMessage = routeError instanceof Error ? routeError.message : String(routeError);
        console.warn(
          `OSRM pair ${index + 1} fallback to raw segment. match=${matchMessage}; route=${routeMessage}`
        );
      }
    }

    appendCoordinates(stitched, segment);
  }

  if (stitched.length < 2) {
    return null;
  }

  const feature: GeoJSON.Feature<GeoJSON.LineString> = {
    type: "Feature",
    properties: {
      snapMethod: "osrm-pairwise-match",
      hadFailures
    },
    geometry: {
      type: "LineString",
      coordinates: stitched
    }
  };

  CACHE.set(key, feature);
  return feature;
}
