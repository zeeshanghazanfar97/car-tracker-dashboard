"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import LoadingState from "@/components/loading";
import { formatDateTime, formatNumber } from "@/lib/format";
import { formatDuration, fromLocalInput, toIsoLocalInput } from "@/lib/time";

const HistoryMap = dynamic(() => import("@/components/maps/history-map"), { ssr: false });

interface HistoryPoint {
  lat: number;
  lon: number;
  time: string;
}

interface SegmentItem {
  id: number;
  plateNumber: string;
  displayName: string | null;
  speedKmh: number | null;
  heading: number | null;
  startTime: string;
  endTime: string;
  durationSec: number;
  lat: number | null;
  lon: number | null;
  locationWarning: string | null;
  road: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  hasTimeAnomaly: boolean;
}

interface HistoryResponse {
  plate: string;
  points: HistoryPoint[];
  snapRequested: boolean;
  snapApplied: boolean;
  snapError: string | null;
  route: {
    raw: GeoJSON.Feature<GeoJSON.LineString> | null;
    snapped: GeoJSON.Feature<GeoJSON.LineString> | null;
  };
  segments: SegmentItem[];
}

interface TripResponse {
  trips: Array<{
    distanceKm: number;
    durationSec: number;
    idleSec: number;
    avgSpeedKmh: number;
    maxSpeedKmh: number;
  }>;
}

export default function VehicleHistoryView({ plate }: { plate: string }) {
  const now = new Date();
  const [fromLocal, setFromLocal] = useState(toIsoLocalInput(new Date(now.getTime() - 24 * 60 * 60 * 1000)));
  const [toLocal, setToLocal] = useState(toIsoLocalInput(now));

  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [trips, setTrips] = useState<TripResponse["trips"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const from = fromLocalInput(fromLocal);
    const to = fromLocalInput(toLocal);

    const [historyRes, tripRes] = await Promise.all([
      fetch(
        `/api/vehicles/${encodeURIComponent(plate)}/history?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        { cache: "no-store" }
      ),
      fetch(
        `/api/reports/trips?plate=${encodeURIComponent(plate)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        { cache: "no-store" }
      )
    ]);

    if (!historyRes.ok) {
      const data = (await historyRes.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? "Failed to load history");
    }

    if (!tripRes.ok) {
      const data = (await tripRes.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? "Failed to load trip stats");
    }

    const historyData = (await historyRes.json()) as HistoryResponse;
    const tripData = (await tripRes.json()) as TripResponse;

    setHistory(historyData);
    setTrips(tripData.trips);
  }, [plate, fromLocal, toLocal]);

  useEffect(() => {
    let cancelled = false;

    const run = async (): Promise<void> => {
      try {
        setLoading(true);
        setError(null);
        await fetchData();
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [fetchData]);

  const summary = useMemo(() => {
    const totalDistance = trips.reduce((sum, trip) => sum + trip.distanceKm, 0);
    const totalDuration = trips.reduce((sum, trip) => sum + trip.durationSec, 0);
    const totalIdle = trips.reduce((sum, trip) => sum + trip.idleSec, 0);
    const maxSpeed = trips.reduce((max, trip) => Math.max(max, trip.maxSpeedKmh), 0);
    const avgSpeed =
      trips.length > 0 ? trips.reduce((sum, trip) => sum + trip.avgSpeedKmh, 0) / trips.length : 0;

    return { totalDistance, totalDuration, totalIdle, maxSpeed, avgSpeed };
  }, [trips]);

  return (
    <section style={{ display: "grid", gap: 14 }}>
      <div className="panel" style={{ padding: 14, display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <h2>Vehicle: {plate}</h2>
            <p className="muted">Time range filtered timeline + route replay</p>
          </div>
          <Link className="buttonLike secondary" href="/">
            Back to fleet
          </Link>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(180px, 1fr))", gap: 8 }}>
          <label>
            <span className="muted">From</span>
            <input
              type="datetime-local"
              value={fromLocal}
              onChange={(event) => setFromLocal(event.target.value)}
            />
          </label>
          <label>
            <span className="muted">To</span>
            <input type="datetime-local" value={toLocal} onChange={(event) => setToLocal(event.target.value)} />
          </label>
          <div style={{ display: "flex", alignItems: "end" }}>
            <button type="button" onClick={() => fetchData().catch((err) => setError(String(err)))}>
              Apply Range
            </button>
          </div>
        </div>
      </div>

      {loading && <LoadingState label="Loading history..." />}
      {error && <p className="badge warn">{error}</p>}
      {history?.snapError && <p className="badge warn">OSRM fallback: {history.snapError}</p>}

      <div className="metricGrid">
        <article className="metric">
          <div className="metricLabel">Distance</div>
          <div className="metricValue">{formatNumber(summary.totalDistance)} km</div>
        </article>
        <article className="metric">
          <div className="metricLabel">Duration</div>
          <div className="metricValue">{formatDuration(summary.totalDuration)}</div>
        </article>
        <article className="metric">
          <div className="metricLabel">Idle</div>
          <div className="metricValue">{formatDuration(summary.totalIdle)}</div>
        </article>
        <article className="metric">
          <div className="metricLabel">Avg / Max Speed</div>
          <div className="metricValue">
            {formatNumber(summary.avgSpeed, 1)} / {formatNumber(summary.maxSpeed, 1)} km/h
          </div>
        </article>
      </div>

      <HistoryMap
        points={history?.points ?? []}
        raw={history?.route.raw ?? null}
        snapped={history?.route.snapped ?? null}
      />

      <section className="panel" style={{ padding: 12 }}>
        <h3 style={{ marginBottom: 10 }}>Timeline</h3>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Start</th>
                <th>End</th>
                <th>Duration</th>
                <th>Speed (km/h)</th>
                <th>Road</th>
                <th>City</th>
                <th>State</th>
                <th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {(history?.segments ?? []).map((segment) => (
                <tr key={segment.id}>
                  <td>{formatDateTime(segment.startTime)}</td>
                  <td>{formatDateTime(segment.endTime)}</td>
                  <td>{formatDuration(segment.durationSec)}</td>
                  <td>{segment.speedKmh === null ? "-" : formatNumber(segment.speedKmh, 1)}</td>
                  <td>{segment.road ?? "-"}</td>
                  <td>{segment.city ?? "-"}</td>
                  <td>{segment.state ?? "-"}</td>
                  <td>
                    {segment.locationWarning && <span className="badge warn">location issue</span>}
                    {segment.hasTimeAnomaly && <span className="badge warn"> time anomaly</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
