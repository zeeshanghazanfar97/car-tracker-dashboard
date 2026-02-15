import { env } from "@/lib/env";
import { haversineMeters } from "@/lib/geo";
import { secondsBetween } from "@/lib/time";
import type { GeoPoint, NormalizedSegment, TripReport } from "@/lib/types";

interface TripThresholds {
  moveDistanceM: number;
  moveSpeedKmh: number;
  stopMinutes: number;
}

interface MutableTrip {
  plateNumber: string;
  displayName: string | null;
  startTime: string;
  endTime: string;
  points: GeoPoint[];
  distanceM: number;
  idleSec: number;
  movingSec: number;
  speedWeightedSum: number;
  speedWeightSec: number;
  maxSpeedKmh: number;
  trailingStationarySec: number;
  lastMovementEnd: string | null;
  lastMovementPointIndex: number;
  hasTimeAnomaly: boolean;
}

function finalizeTrip(trip: MutableTrip, terminalStopExceeded: boolean): TripReport | null {
  const endTime = trip.lastMovementEnd ?? trip.endTime;
  const durationSec = secondsBetween(trip.startTime, endTime);
  if (durationSec <= 0) return null;

  let idleSec = trip.idleSec;
  if (terminalStopExceeded) {
    idleSec = Math.max(0, idleSec - trip.trailingStationarySec);
  }

  const trimmedPoints =
    terminalStopExceeded && trip.lastMovementPointIndex >= 0
      ? trip.points.slice(0, trip.lastMovementPointIndex + 1)
      : trip.points;

  const startPoint = trimmedPoints[0] ?? null;
  const endPoint = trimmedPoints[trimmedPoints.length - 1] ?? null;

  const avgSpeedKmh =
    trip.speedWeightSec > 0 ? Number((trip.speedWeightedSum / trip.speedWeightSec).toFixed(2)) : 0;

  return {
    plateNumber: trip.plateNumber,
    displayName: trip.displayName,
    startTime: trip.startTime,
    endTime,
    durationSec,
    idleSec,
    movingSec: Math.max(0, durationSec - idleSec),
    distanceKm: Number((trip.distanceM / 1000).toFixed(3)),
    avgSpeedKmh,
    maxSpeedKmh: Number(trip.maxSpeedKmh.toFixed(2)),
    startLat: startPoint?.lat ?? null,
    startLon: startPoint?.lon ?? null,
    endLat: endPoint?.lat ?? null,
    endLon: endPoint?.lon ?? null,
    points: trimmedPoints,
    hasTimeAnomaly: trip.hasTimeAnomaly
  };
}

function startTrip(segment: NormalizedSegment): MutableTrip {
  const points = segment.point ? [segment.point] : [];
  const speed = segment.speed_kmh ?? 0;
  const duration = segment.duration_sec;

  return {
    plateNumber: segment.plate_number,
    displayName: segment.display_name,
    startTime: segment.effective_start,
    endTime: segment.effective_end,
    points,
    distanceM: 0,
    idleSec: 0,
    movingSec: duration,
    speedWeightedSum: speed * duration,
    speedWeightSec: duration,
    maxSpeedKmh: speed,
    trailingStationarySec: 0,
    lastMovementEnd: segment.effective_end,
    lastMovementPointIndex: points.length - 1,
    hasTimeAnomaly: segment.has_time_anomaly
  };
}

export function inferTripsForPlate(
  segments: NormalizedSegment[],
  thresholds: TripThresholds = {
    moveDistanceM: env.moveDistanceM,
    moveSpeedKmh: env.moveSpeedKmh,
    stopMinutes: env.stopMinutes
  }
): TripReport[] {
  if (segments.length === 0) return [];

  const stopThresholdSec = thresholds.stopMinutes * 60;
  const trips: TripReport[] = [];

  let trip: MutableTrip | null = null;
  let prevPoint: GeoPoint | null = null;

  for (const segment of segments) {
    const speed = segment.speed_kmh ?? 0;
    const duration = segment.duration_sec;

    let deltaDistanceM = 0;
    if (prevPoint && segment.point) {
      deltaDistanceM = haversineMeters(prevPoint, segment.point);
    }

    const isMovement = deltaDistanceM >= thresholds.moveDistanceM || speed >= thresholds.moveSpeedKmh;

    if (!trip) {
      if (isMovement) {
        trip = startTrip(segment);
      }
      prevPoint = segment.point ?? prevPoint;
      continue;
    }

    trip.endTime = segment.effective_end;
    trip.hasTimeAnomaly = trip.hasTimeAnomaly || segment.has_time_anomaly;

    if (segment.point) {
      const lastTripPoint = trip.points[trip.points.length - 1] ?? null;
      if (lastTripPoint) {
        trip.distanceM += haversineMeters(lastTripPoint, segment.point);
      }
      trip.points.push(segment.point);
    }

    if (isMovement) {
      trip.movingSec += duration;
      trip.trailingStationarySec = 0;
      trip.lastMovementEnd = segment.effective_end;
      if (segment.point) {
        trip.lastMovementPointIndex = trip.points.length - 1;
      }

      trip.speedWeightedSum += speed * duration;
      trip.speedWeightSec += duration;
      trip.maxSpeedKmh = Math.max(trip.maxSpeedKmh, speed);
    } else {
      trip.idleSec += duration;
      trip.trailingStationarySec += duration;

      if (trip.trailingStationarySec >= stopThresholdSec) {
        const finalTrip = finalizeTrip(trip, true);
        if (finalTrip) trips.push(finalTrip);
        trip = null;
      }
    }

    prevPoint = segment.point ?? prevPoint;
  }

  if (trip) {
    const finalTrip = finalizeTrip(trip, false);
    if (finalTrip) trips.push(finalTrip);
  }

  return trips;
}

export function inferTrips(
  segments: NormalizedSegment[],
  thresholds?: TripThresholds
): TripReport[] {
  const byPlate = new Map<string, NormalizedSegment[]>();
  for (const seg of segments) {
    const list = byPlate.get(seg.plate_number) ?? [];
    list.push(seg);
    byPlate.set(seg.plate_number, list);
  }

  const trips: TripReport[] = [];
  for (const list of byPlate.values()) {
    list.sort((a, b) => new Date(a.effective_start).getTime() - new Date(b.effective_start).getTime());
    trips.push(...inferTripsForPlate(list, thresholds));
  }

  return trips.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
}
