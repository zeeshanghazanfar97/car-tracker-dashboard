import { parseLocationText } from "@/lib/geo";
import { secondsBetween } from "@/lib/time";
import type { NormalizedSegment, TrackingSegmentRow } from "@/lib/types";

function asIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function normalizeSegments(rows: TrackingSegmentRow[]): NormalizedSegment[] {
  const normalized: NormalizedSegment[] = [];
  let previousStartInSourceOrder: number | null = null;

  for (const row of rows) {
    const firstGps = asIso(row.first_gps_timestamp);
    const lastGps = asIso(row.last_gps_timestamp);
    const firstServer = asIso(row.first_server_timestamp);
    const lastServer = asIso(row.last_server_timestamp);

    const effectiveStart = firstGps ?? firstServer;
    const effectiveEnd = lastGps ?? lastServer;
    if (!effectiveStart || !effectiveEnd) continue;

    const { point } = parseLocationText(row.location_text);

    const startMs = new Date(effectiveStart).getTime();
    const endMs = new Date(effectiveEnd).getTime();
    const hasTimeAnomaly =
      (previousStartInSourceOrder !== null && startMs < previousStartInSourceOrder) || endMs < startMs;

    normalized.push({
      ...row,
      first_gps_timestamp: firstGps,
      last_gps_timestamp: lastGps,
      first_server_timestamp: firstServer,
      last_server_timestamp: lastServer,
      point,
      effective_start: effectiveStart,
      effective_end: effectiveEnd,
      duration_sec: secondsBetween(effectiveStart, effectiveEnd),
      has_time_anomaly: hasTimeAnomaly
    });

    previousStartInSourceOrder = startMs;
  }

  normalized.sort((a, b) => {
    const t1 = new Date(a.effective_start).getTime();
    const t2 = new Date(b.effective_start).getTime();
    if (t1 !== t2) return t1 - t2;

    const e1 = new Date(a.effective_end).getTime();
    const e2 = new Date(b.effective_end).getTime();
    if (e1 !== e2) return e1 - e2;

    return a.id - b.id;
  });

  return normalized;
}
