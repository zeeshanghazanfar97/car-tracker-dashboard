"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import LoadingState from "@/components/loading";
import { formatDateTime, formatNumber } from "@/lib/format";
import { formatDuration, fromLocalInput, toIsoLocalInput } from "@/lib/time";

const RouteMap = dynamic(() => import("@/components/maps/route-map"), { ssr: false });

interface RouteResponse {
  plate: string;
  from: string;
  to: string;
  snapRequested: boolean;
  snapApplied: boolean;
  snapError: string | null;
  route: {
    raw: GeoJSON.Feature<GeoJSON.LineString> | null;
    snapped: GeoJSON.Feature<GeoJSON.LineString> | null;
  };
  points: Array<{ lat: number; lon: number }>;
  trips: Array<{
    startTime: string;
    endTime: string;
    distanceKm: number;
    durationSec: number;
    idleSec: number;
    movingSec: number;
    avgSpeedKmh: number;
    maxSpeedKmh: number;
  }>;
}

interface TripMapViewProps {
  initialPlate: string;
  initialFrom: string;
  initialTo: string;
  initialSnap: boolean;
}

export default function TripMapView({
  initialPlate,
  initialFrom,
  initialTo,
  initialSnap
}: TripMapViewProps) {
  const [plate, setPlate] = useState(initialPlate);
  const [fromLocal, setFromLocal] = useState(toIsoLocalInput(new Date(initialFrom)));
  const [toLocal, setToLocal] = useState(toIsoLocalInput(new Date(initialTo)));
  const [snap, setSnap] = useState(initialSnap);

  const [data, setData] = useState<RouteResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fromIso = fromLocalInput(fromLocal);
  const toIso = fromLocalInput(toLocal);

  const fetchRoute = useCallback(async () => {
    const params = new URLSearchParams({
      plate: plate.trim(),
      from: fromIso,
      to: toIso,
      snap: String(snap)
    });

    const response = await fetch(`/api/reports/trips/route?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error ?? "Failed to load route");
    }

    const payload = (await response.json()) as RouteResponse;
    setData(payload);
  }, [plate, fromIso, toIso, snap]);

  useEffect(() => {
    let cancelled = false;

    const run = async (): Promise<void> => {
      try {
        setLoading(true);
        setError(null);
        await fetchRoute();
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
  }, [fetchRoute]);

  const totals = useMemo(() => {
    return (data?.trips ?? []).reduce(
      (acc, trip) => {
        acc.distance += trip.distanceKm;
        acc.duration += trip.durationSec;
        acc.idle += trip.idleSec;
        acc.maxSpeed = Math.max(acc.maxSpeed, trip.maxSpeedKmh);
        return acc;
      },
      { distance: 0, duration: 0, idle: 0, maxSpeed: 0 }
    );
  }, [data?.trips]);

  return (
    <section style={{ display: "grid", gap: 14 }}>
      <section className="panel" style={{ padding: 14, display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Trip Map</h2>
          <Link className="buttonLike secondary" href="/reports/trips">
            Back to Reports
          </Link>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto auto", gap: 8 }}>
          <label>
            <span className="muted">Plate</span>
            <input value={plate} onChange={(event) => setPlate(event.target.value)} />
          </label>
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
          <label style={{ display: "flex", alignItems: "end", gap: 8 }}>
            <input
              type="checkbox"
              checked={snap}
              onChange={(event) => setSnap(event.target.checked)}
              style={{ width: 18, height: 18 }}
            />
            Snap to roads
          </label>
          <div style={{ display: "flex", alignItems: "end" }}>
            <button type="button" onClick={() => fetchRoute().catch((err) => setError(String(err)))}>
              Load
            </button>
          </div>
        </div>
      </section>

      {loading && <LoadingState label="Loading route geometry..." />}
      {error && <p className="badge warn">{error}</p>}
      {data?.snapError && <p className="badge warn">OSRM fallback: {data.snapError}</p>}
      {data && data.points.length === 0 && (
        <p className="badge warn">No valid coordinates found for selected window.</p>
      )}

      <div className="metricGrid">
        <article className="metric">
          <div className="metricLabel">Trips in window</div>
          <div className="metricValue">{data?.trips.length ?? 0}</div>
        </article>
        <article className="metric">
          <div className="metricLabel">Distance</div>
          <div className="metricValue">{formatNumber(totals.distance)} km</div>
        </article>
        <article className="metric">
          <div className="metricLabel">Duration / Idle</div>
          <div className="metricValue">
            {formatDuration(totals.duration)} / {formatDuration(totals.idle)}
          </div>
        </article>
        <article className="metric">
          <div className="metricLabel">Max Speed</div>
          <div className="metricValue">{formatNumber(totals.maxSpeed, 1)} km/h</div>
        </article>
      </div>

      <RouteMap points={data?.points ?? []} raw={data?.route.raw ?? null} snapped={data?.route.snapped ?? null} />

      <section className="panel" style={{ padding: 12 }}>
        <h3 style={{ marginBottom: 10 }}>Trip Segments In Selected Window</h3>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Start</th>
                <th>End</th>
                <th>Duration</th>
                <th>Distance (km)</th>
                <th>Idle</th>
                <th>Avg / Max speed</th>
              </tr>
            </thead>
            <tbody>
              {(data?.trips ?? []).map((trip, idx) => (
                <tr key={`${trip.startTime}-${idx}`}>
                  <td>{formatDateTime(trip.startTime)}</td>
                  <td>{formatDateTime(trip.endTime)}</td>
                  <td>{formatDuration(trip.durationSec)}</td>
                  <td>{formatNumber(trip.distanceKm, 3)}</td>
                  <td>{formatDuration(trip.idleSec)}</td>
                  <td>
                    {formatNumber(trip.avgSpeedKmh, 1)} / {formatNumber(trip.maxSpeedKmh, 1)}
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
