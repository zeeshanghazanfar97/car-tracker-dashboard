import { describe, expect, it } from "vitest";
import { inferTripsForPlate } from "@/lib/trips";
import type { NormalizedSegment } from "@/lib/types";

function segment(partial: Partial<NormalizedSegment> & Pick<NormalizedSegment, "id">): NormalizedSegment {
  return {
    id: partial.id,
    plate_number: partial.plate_number ?? "ABC123",
    speed_kmh: partial.speed_kmh ?? 0,
    heading: null,
    first_gps_timestamp: partial.first_gps_timestamp ?? partial.effective_start ?? null,
    last_gps_timestamp: partial.last_gps_timestamp ?? partial.effective_end ?? null,
    first_server_timestamp: null,
    last_server_timestamp: null,
    display_name: partial.display_name ?? "Unit 1",
    road: null,
    suburb: null,
    city: null,
    subdistrict: null,
    county: null,
    state_district: null,
    state: null,
    postcode: null,
    country: null,
    country_code: null,
    raw_tracker: null,
    raw_geocode: null,
    created_at: null,
    updated_at: null,
    location_text: null,
    point: partial.point ?? null,
    effective_start: partial.effective_start ?? "2026-01-01T00:00:00.000Z",
    effective_end: partial.effective_end ?? "2026-01-01T00:01:00.000Z",
    duration_sec: partial.duration_sec ?? 60,
    has_time_anomaly: partial.has_time_anomaly ?? false
  };
}

describe("trip inference", () => {
  it("creates one trip for continuous movement", () => {
    const rows: NormalizedSegment[] = [
      segment({
        id: 1,
        speed_kmh: 20,
        point: { lat: 24.71, lon: 46.67 },
        effective_start: "2026-01-01T00:00:00.000Z",
        effective_end: "2026-01-01T00:02:00.000Z",
        duration_sec: 120
      }),
      segment({
        id: 2,
        speed_kmh: 24,
        point: { lat: 24.72, lon: 46.68 },
        effective_start: "2026-01-01T00:02:00.000Z",
        effective_end: "2026-01-01T00:04:00.000Z",
        duration_sec: 120
      })
    ];

    const trips = inferTripsForPlate(rows, { moveDistanceM: 50, moveSpeedKmh: 5, stopMinutes: 5 });

    expect(trips.length).toBe(1);
    expect(trips[0].durationSec).toBe(240);
    expect(trips[0].distanceKm).toBeGreaterThan(1);
  });

  it("splits trips when stop threshold is exceeded", () => {
    const rows: NormalizedSegment[] = [
      segment({
        id: 1,
        speed_kmh: 35,
        point: { lat: 24.71, lon: 46.67 },
        effective_start: "2026-01-01T08:00:00.000Z",
        effective_end: "2026-01-01T08:05:00.000Z",
        duration_sec: 300
      }),
      segment({
        id: 2,
        speed_kmh: 0,
        point: { lat: 24.71, lon: 46.67 },
        effective_start: "2026-01-01T08:05:00.000Z",
        effective_end: "2026-01-01T08:12:00.000Z",
        duration_sec: 420
      }),
      segment({
        id: 3,
        speed_kmh: 26,
        point: { lat: 24.75, lon: 46.71 },
        effective_start: "2026-01-01T08:12:00.000Z",
        effective_end: "2026-01-01T08:18:00.000Z",
        duration_sec: 360
      })
    ];

    const trips = inferTripsForPlate(rows, { moveDistanceM: 50, moveSpeedKmh: 5, stopMinutes: 5 });

    expect(trips.length).toBe(2);
    expect(trips[0].endTime).toBe("2026-01-01T08:05:00.000Z");
    expect(trips[1].startTime).toBe("2026-01-01T08:12:00.000Z");
  });

  it("keeps short pauses within one trip", () => {
    const rows: NormalizedSegment[] = [
      segment({
        id: 1,
        speed_kmh: 30,
        point: { lat: 24.71, lon: 46.67 },
        effective_start: "2026-01-01T10:00:00.000Z",
        effective_end: "2026-01-01T10:03:00.000Z",
        duration_sec: 180
      }),
      segment({
        id: 2,
        speed_kmh: 0,
        point: { lat: 24.71, lon: 46.67 },
        effective_start: "2026-01-01T10:03:00.000Z",
        effective_end: "2026-01-01T10:05:00.000Z",
        duration_sec: 120
      }),
      segment({
        id: 3,
        speed_kmh: 32,
        point: { lat: 24.73, lon: 46.69 },
        effective_start: "2026-01-01T10:05:00.000Z",
        effective_end: "2026-01-01T10:10:00.000Z",
        duration_sec: 300
      })
    ];

    const trips = inferTripsForPlate(rows, { moveDistanceM: 50, moveSpeedKmh: 5, stopMinutes: 5 });

    expect(trips.length).toBe(1);
    expect(trips[0].idleSec).toBe(120);
  });
});
