"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import LoadingState from "@/components/loading";
import { formatDateTime, formatNumber } from "@/lib/format";
import { formatDuration, fromLocalInput, toIsoLocalInput } from "@/lib/time";

interface TripItem {
  plateNumber: string;
  displayName: string | null;
  startTime: string;
  endTime: string;
  durationSec: number;
  idleSec: number;
  movingSec: number;
  distanceKm: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  startLat: number | null;
  startLon: number | null;
  endLat: number | null;
  endLon: number | null;
  hasTimeAnomaly: boolean;
}

interface TripResponse {
  trips: TripItem[];
}

export default function TripReportsView() {
  const now = new Date();

  const [plateInput, setPlateInput] = useState("");
  const [fromLocal, setFromLocal] = useState(toIsoLocalInput(new Date(now.getTime() - 24 * 60 * 60 * 1000)));
  const [toLocal, setToLocal] = useState(toIsoLocalInput(now));

  const [trips, setTrips] = useState<TripItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fromIso = fromLocalInput(fromLocal);
  const toIso = fromLocalInput(toLocal);

  const fetchTrips = useCallback(async () => {
    const params = new URLSearchParams({ from: fromIso, to: toIso });
    if (plateInput.trim()) params.set("plate", plateInput.trim());

    const response = await fetch(`/api/reports/trips?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? "Failed to load trips");
    }

    const data = (await response.json()) as TripResponse;
    setTrips(data.trips);
  }, [fromIso, toIso, plateInput]);

  useEffect(() => {
    let cancelled = false;

    const run = async (): Promise<void> => {
      try {
        setLoading(true);
        setError(null);
        await fetchTrips();
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
  }, [fetchTrips]);

  const totals = useMemo(() => {
    return trips.reduce(
      (acc, trip) => {
        acc.distance += trip.distanceKm;
        acc.duration += trip.durationSec;
        acc.idle += trip.idleSec;
        acc.maxSpeed = Math.max(acc.maxSpeed, trip.maxSpeedKmh);
        return acc;
      },
      { distance: 0, duration: 0, idle: 0, maxSpeed: 0 }
    );
  }, [trips]);

  const csvUrl = useMemo(() => {
    const params = new URLSearchParams({ from: fromIso, to: toIso });
    if (plateInput.trim()) params.set("plate", plateInput.trim());
    return `/api/reports/trips/export.csv?${params.toString()}`;
  }, [fromIso, toIso, plateInput]);

  return (
    <section className="viewStack">
      <section className="panel sectionPanel">
        <h2>Trip Reports</h2>
        <p className="muted">Generate operational trip reports with distance, duration, idle, and speed KPIs.</p>

        <div className="reportFiltersGrid">
          <label>
            <span className="muted">Plate(s), comma separated</span>
            <input
              value={plateInput}
              onChange={(event) => setPlateInput(event.target.value)}
              placeholder="ABC123,XYZ987"
            />
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

          <div className="filterActionCell">
            <button type="button" onClick={() => fetchTrips().catch((err) => setError(String(err)))}>
              Run Report
            </button>
          </div>
          <div className="filterActionCell">
            <a className="buttonLike secondary" href={csvUrl}>
              Export CSV
            </a>
          </div>
        </div>
      </section>

      {loading && <LoadingState label="Generating trip report..." />}
      {error && <p className="badge warn">{error}</p>}

      <div className="metricGrid">
        <article className="metric">
          <div className="metricLabel">Trips</div>
          <div className="metricValue">{trips.length}</div>
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

      <section className="panel sectionPanel">
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Plate</th>
                <th>Start</th>
                <th>End</th>
                <th>Duration</th>
                <th>Idle</th>
                <th>Distance (km)</th>
                <th>Avg / Max Speed</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {trips.map((trip, index) => (
                <tr key={`${trip.plateNumber}-${trip.startTime}-${index}`}>
                  <td>
                    <strong>{trip.plateNumber}</strong>
                    <div className="muted">{trip.displayName ?? "-"}</div>
                  </td>
                  <td>{formatDateTime(trip.startTime)}</td>
                  <td>{formatDateTime(trip.endTime)}</td>
                  <td>{formatDuration(trip.durationSec)}</td>
                  <td>{formatDuration(trip.idleSec)}</td>
                  <td>{formatNumber(trip.distanceKm, 3)}</td>
                  <td>
                    {formatNumber(trip.avgSpeedKmh, 1)} / {formatNumber(trip.maxSpeedKmh, 1)}
                  </td>
                  <td>
                    <div className="rowActionStack">
                      <Link
                        className="buttonLike"
                        href={`/reports/trips/map?plate=${encodeURIComponent(trip.plateNumber)}&from=${encodeURIComponent(
                          trip.startTime
                        )}&to=${encodeURIComponent(trip.endTime)}&snap=true`}
                      >
                        Open Map
                      </Link>
                      <Link className="buttonLike secondary" href={`/vehicle/${encodeURIComponent(trip.plateNumber)}`}>
                        Vehicle View
                      </Link>
                      {trip.hasTimeAnomaly && <span className="badge warn">time anomaly</span>}
                    </div>
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
