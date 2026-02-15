import type { GeoPoint } from "@/lib/types";

const POINT_PG_REGEX = /^\(([-+\d.]+),\s*([-+\d.]+)\)$/;
const POINT_WKT_REGEX = /^POINT\s*\(\s*([-+\d.]+)\s+([-+\d.]+)\s*\)$/i;
const POINT_WKT_SRID_REGEX = /^SRID=\d+;\s*POINT(?:\s+[A-Z]+)?\s*\(\s*([-+\d.]+)\s+([-+\d.]+)(?:\s+[-+\d.]+(?:\s+[-+\d.]+)?)?\s*\)$/i;
const POINT_CSV_REGEX = /^([-+\d.]+)\s*,\s*([-+\d.]+)$/;
const HEX_EWKB_REGEX = /^(?:\\x)?[0-9a-fA-F]+$/;

function isValidLatLon(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

function pickPoint(a: number, b: number, assumeLonLat: boolean): GeoPoint | null {
  const candidatePrimary = assumeLonLat ? { lat: b, lon: a } : { lat: a, lon: b };
  if (isValidLatLon(candidatePrimary.lat, candidatePrimary.lon)) {
    return candidatePrimary;
  }

  const candidateFlipped = assumeLonLat ? { lat: a, lon: b } : { lat: b, lon: a };
  if (isValidLatLon(candidateFlipped.lat, candidateFlipped.lon)) {
    return candidateFlipped;
  }

  return null;
}

function parseGeoJsonPoint(text: string): GeoPoint | null {
  try {
    const parsed = JSON.parse(text) as { type?: unknown; coordinates?: unknown };
    if (parsed.type !== "Point") return null;
    if (!Array.isArray(parsed.coordinates) || parsed.coordinates.length < 2) return null;

    const lon = Number(parsed.coordinates[0]);
    const lat = Number(parsed.coordinates[1]);
    return isValidLatLon(lat, lon) ? { lat, lon } : null;
  } catch {
    return null;
  }
}

function parseEwkbPoint(text: string): GeoPoint | null {
  if (!HEX_EWKB_REGEX.test(text)) return null;
  const hex = text.startsWith("\\x") ? text.slice(2) : text;
  if (hex.length % 2 !== 0) return null;

  const buffer = Buffer.from(hex, "hex");
  if (buffer.length < 1 + 4 + 16) return null;

  const littleEndian = buffer.readUInt8(0) === 1;
  const readUInt32 = (offset: number): number =>
    littleEndian ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset);
  const readDouble = (offset: number): number =>
    littleEndian ? buffer.readDoubleLE(offset) : buffer.readDoubleBE(offset);

  const typeWithFlags = readUInt32(1);
  const hasSrid = (typeWithFlags & 0x20000000) !== 0;
  const type = typeWithFlags & 0x000000ff;
  if (type !== 1) return null;

  let offset = 5;
  if (hasSrid) {
    if (buffer.length < offset + 4 + 16) return null;
    offset += 4;
  }

  if (buffer.length < offset + 16) return null;
  const lon = readDouble(offset);
  const lat = readDouble(offset + 8);
  return isValidLatLon(lat, lon) ? { lat, lon } : null;
}

export function parseLocationText(locationText: string | null): { point: GeoPoint | null; warning: string | null } {
  if (!locationText) {
    return { point: null, warning: "location_missing" };
  }

  let trimmed = locationText.trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }

  const pgMatch = trimmed.match(POINT_PG_REGEX);
  if (pgMatch) {
    const point = pickPoint(Number(pgMatch[1]), Number(pgMatch[2]), true);
    if (point) return { point, warning: null };
  }

  const wktMatch = trimmed.match(POINT_WKT_REGEX);
  if (wktMatch) {
    const point = pickPoint(Number(wktMatch[1]), Number(wktMatch[2]), true);
    if (point) return { point, warning: null };
  }

  const wktSridMatch = trimmed.match(POINT_WKT_SRID_REGEX);
  if (wktSridMatch) {
    const point = pickPoint(Number(wktSridMatch[1]), Number(wktSridMatch[2]), true);
    if (point) return { point, warning: null };
  }

  const csvMatch = trimmed.match(POINT_CSV_REGEX);
  if (csvMatch) {
    const point = pickPoint(Number(csvMatch[1]), Number(csvMatch[2]), true);
    if (point) return { point, warning: null };
  }

  const geoJsonPoint = parseGeoJsonPoint(trimmed);
  if (geoJsonPoint) {
    return { point: geoJsonPoint, warning: null };
  }

  const ewkbPoint = parseEwkbPoint(trimmed);
  if (ewkbPoint) {
    return { point: ewkbPoint, warning: null };
  }

  return { point: null, warning: "location_parse_failed" };
}

export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180;

  const earthRadiusMeters = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);

  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDlat = Math.sin(dLat / 2);
  const sinDlon = Math.sin(dLon / 2);

  const aa = sinDlat ** 2 + Math.cos(lat1) * Math.cos(lat2) * sinDlon ** 2;
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));

  return earthRadiusMeters * c;
}

export function toLatLonArray(points: GeoPoint[]): [number, number][] {
  return points.map((p) => [p.lat, p.lon]);
}

export function toGeoJsonLine(points: GeoPoint[]): GeoJSON.Feature<GeoJSON.LineString> | null {
  if (points.length < 2) return null;
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: points.map((p) => [p.lon, p.lat])
    }
  };
}
