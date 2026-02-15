import { getPool } from "@/lib/db";
import { parseLocationText } from "@/lib/geo";
import { normalizeSegments } from "@/lib/normalize";
import type { NormalizedSegment, TrackingSegmentRow, VehicleCurrentLocation } from "@/lib/types";

const BASE_SELECT = `
  SELECT
    id,
    plate_number,
    speed_kmh,
    heading,
    first_gps_timestamp,
    last_gps_timestamp,
    first_server_timestamp,
    last_server_timestamp,
    display_name,
    road,
    suburb,
    city,
    subdistrict,
    county,
    state_district,
    state,
    postcode,
    country,
    country_code,
    raw_tracker,
    raw_geocode,
    created_at,
    updated_at,
    location::text AS location_text
  FROM vehicle_tracking_data_v3
`;

export async function getCurrentVehicles(params: {
  plate?: string;
  activeWithinMinutes?: number;
}): Promise<VehicleCurrentLocation[]> {
  const pool = getPool();
  const sql = `
    SELECT DISTINCT ON (plate_number)
      id,
      plate_number,
      speed_kmh,
      heading,
      display_name,
      road,
      city,
      last_gps_timestamp,
      last_server_timestamp,
      location::text AS location_text
    FROM vehicle_tracking_data_v3
    WHERE ($1::text IS NULL OR plate_number = $1::text)
      AND (
        $2::integer IS NULL
        OR COALESCE(last_server_timestamp, last_gps_timestamp) >= NOW() - ($2::text || ' minutes')::interval
      )
    ORDER BY plate_number, last_server_timestamp DESC NULLS LAST, id DESC
  `;

  const result = await pool.query<{
    id: number;
    plate_number: string;
    speed_kmh: number | null;
    heading: number | null;
    display_name: string | null;
    road: string | null;
    city: string | null;
    last_gps_timestamp: string | Date | null;
    last_server_timestamp: string | Date | null;
    location_text: string | null;
  }>(sql, [params.plate ?? null, params.activeWithinMinutes ?? null]);

  return result.rows.map((row) => {
    const { point, warning } = parseLocationText(row.location_text);
    return {
      id: row.id,
      plateNumber: row.plate_number,
      displayName: row.display_name,
      road: row.road,
      city: row.city,
      speedKmh: row.speed_kmh,
      heading: row.heading,
      lastGpsTimestamp: row.last_gps_timestamp
        ? new Date(row.last_gps_timestamp).toISOString()
        : null,
      lastServerTimestamp: row.last_server_timestamp
        ? new Date(row.last_server_timestamp).toISOString()
        : null,
      lat: point?.lat ?? null,
      lon: point?.lon ?? null,
      locationWarning: warning
    };
  });
}

export async function getVehicleHistorySegments(params: {
  plate: string;
  fromIso: string;
  toIso: string;
}): Promise<NormalizedSegment[]> {
  const pool = getPool();

  const sql = `
    ${BASE_SELECT}
    WHERE plate_number = $1
      AND COALESCE(last_gps_timestamp, last_server_timestamp) >= $2::timestamptz
      AND COALESCE(first_gps_timestamp, first_server_timestamp) <= $3::timestamptz
    ORDER BY
      COALESCE(first_gps_timestamp, first_server_timestamp) ASC,
      COALESCE(last_gps_timestamp, last_server_timestamp) ASC,
      id ASC
  `;

  const result = await pool.query<TrackingSegmentRow>(sql, [
    params.plate,
    params.fromIso,
    params.toIso
  ]);

  return normalizeSegments(result.rows);
}

export async function getFleetSegmentsByRange(params: {
  plates?: string[];
  fromIso: string;
  toIso: string;
}): Promise<NormalizedSegment[]> {
  const pool = getPool();

  const where = [
    "COALESCE(last_gps_timestamp, last_server_timestamp) >= $1::timestamptz",
    "COALESCE(first_gps_timestamp, first_server_timestamp) <= $2::timestamptz"
  ];
  const values: Array<string | string[]> = [params.fromIso, params.toIso];

  if (params.plates && params.plates.length > 0) {
    where.push(`plate_number = ANY($${values.length + 1}::text[])`);
    values.push(params.plates);
  }

  const sql = `
    ${BASE_SELECT}
    WHERE ${where.join(" AND ")}
    ORDER BY
      plate_number ASC,
      COALESCE(first_gps_timestamp, first_server_timestamp) ASC,
      COALESCE(last_gps_timestamp, last_server_timestamp) ASC,
      id ASC
  `;

  const result = await pool.query<TrackingSegmentRow>(sql, values);
  return normalizeSegments(result.rows);
}
