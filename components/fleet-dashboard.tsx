"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import LoadingState from "@/components/loading";
import { ageFromNow, formatDateTime, formatNumber } from "@/lib/format";
import { computePollDelayMs } from "@/lib/polling";
import { publicEnv } from "@/lib/public-env";
import type { VehicleCurrentLocation } from "@/lib/types";

const FleetMap = dynamic(() => import("@/components/maps/fleet-map"), { ssr: false });

interface CurrentResponse {
  vehicles: VehicleCurrentLocation[];
  pollIntervalSec: number;
  fetchedAt: string;
}

export default function FleetDashboard() {
  const [vehicles, setVehicles] = useState<VehicleCurrentLocation[]>([]);
  const [search, setSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [selectedPlate, setSelectedPlate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<"connecting" | "live" | "degraded">("connecting");
  const [lastSuccessAt, setLastSuccessAt] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const fetchVehicles = useCallback(async (signal?: AbortSignal): Promise<boolean> => {
    if (inFlightRef.current) {
      return false;
    }

    inFlightRef.current = true;
    try {
      const params = new URLSearchParams();
      if (activeOnly) params.set("activeWithinMinutes", "30");

      const response = await fetch(`/api/vehicles/current?${params.toString()}`, {
        cache: "no-store",
        signal
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Failed to fetch vehicles");
      }

      const data = (await response.json()) as CurrentResponse;
      setVehicles(data.vehicles);
      setSelectedPlate((current) => {
        if (current && data.vehicles.some((vehicle) => vehicle.plateNumber === current)) {
          return current;
        }
        return data.vehicles[0]?.plateNumber ?? null;
      });
      return true;
    } finally {
      inFlightRef.current = false;
    }
  }, [activeOnly]);

  useEffect(() => {
    let cancelled = false;
    let isInitial = true;
    let consecutiveErrors = 0;
    let timer: number | undefined;
    let abortController: AbortController | null = null;

    const pollOnce = async (): Promise<void> => {
      if (cancelled) return;

      try {
        if (isInitial) {
          setLoading(true);
        }
        setConnectionState((state) => (state === "live" ? "live" : "connecting"));

        abortController?.abort();
        abortController = new AbortController();

        const fetched = await fetchVehicles(abortController.signal);
        if (!cancelled && fetched) {
          consecutiveErrors = 0;
          setError(null);
          setConnectionState("live");
          setLastSuccessAt(new Date().toISOString());
        }
      } catch (err) {
        if (
          err instanceof DOMException &&
          (err.name === "AbortError" || err.message.includes("aborted"))
        ) {
          return;
        }
        if (!cancelled) {
          consecutiveErrors += 1;
          setError(err instanceof Error ? err.message : "Unknown error");
          setConnectionState("degraded");
        }
      } finally {
        if (!cancelled) {
          if (isInitial) {
            setLoading(false);
            isInitial = false;
          }

          const delayMs = computePollDelayMs({
            isHidden: document.visibilityState === "hidden",
            activeIntervalSec: publicEnv.activePollIntervalSec,
            backgroundIntervalSec: publicEnv.backgroundPollIntervalSec,
            consecutiveErrors
          });
          timer = window.setTimeout(() => {
            void pollOnce();
          }, delayMs);
        }
      }
    };

    const onVisibilityChange = (): void => {
      if (cancelled) return;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void pollOnce();
      }, 0);
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    void pollOnce();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      abortController?.abort();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [fetchVehicles]);

  const handleManualRefresh = useCallback(() => {
    setConnectionState("connecting");
    setLoading(true);
    fetchVehicles()
      .then((fetched) => {
        if (fetched) {
          setError(null);
          setConnectionState("live");
          setLastSuccessAt(new Date().toISOString());
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Unknown error");
        setConnectionState("degraded");
      })
      .finally(() => setLoading(false));
  }, [fetchVehicles]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return vehicles;
    return vehicles.filter((vehicle) => {
      return (
        vehicle.plateNumber.toLowerCase().includes(needle) ||
        (vehicle.displayName ?? "").toLowerCase().includes(needle)
      );
    });
  }, [vehicles, search]);

  const selectedVehicle = useMemo(
    () => filtered.find((vehicle) => vehicle.plateNumber === selectedPlate) ?? null,
    [filtered, selectedPlate]
  );
  const missingCoords = filtered.filter((vehicle) => vehicle.lat === null || vehicle.lon === null).length;
  const statusLabel =
    connectionState === "live"
      ? "Live updates"
      : connectionState === "degraded"
        ? "Connection degraded"
        : "Syncing";

  return (
    <section className="pageGrid fleetLayout">
      <aside className="panel fleetSidebar">
        <div className="controls">
          <div className="controlsSticky">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search plate or display name"
            />
            <label className="checkboxControl">
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(event) => setActiveOnly(event.target.checked)}
              />
              Active in last 30 minutes
            </label>
            <button type="button" onClick={handleManualRefresh}>
              Refresh Now
            </button>
            <div className="fleetStatusRow">
              <span className={`statusBadge ${connectionState}`}>{statusLabel}</span>
              {lastSuccessAt && <span className="muted">Last sync: {ageFromNow(lastSuccessAt)}</span>}
            </div>
          </div>
        </div>

        <div className="fleetListContent">
          {loading && <LoadingState label="Loading fleet positions..." />}
          {error && <p className="badge warn">{error}</p>}
          {missingCoords > 0 && (
            <p className="badge warn">{missingCoords} vehicle(s) have invalid or missing coordinates.</p>
          )}
          {!loading && filtered.length === 0 && <p className="muted">No vehicles found for this filter.</p>}

          <div className="vehicleList">
            {filtered.map((vehicle) => (
              <article
                className={`vehicleCard ${vehicle.plateNumber === selectedPlate ? "active" : ""}`}
                key={vehicle.plateNumber}
              >
                <div className="vehicleCardHeader">
                  <button
                    type="button"
                    className="secondary vehicleSelect"
                    onClick={() => setSelectedPlate(vehicle.plateNumber)}
                  >
                    <strong>{vehicle.plateNumber}</strong>
                    <div className="muted">{vehicle.displayName ?? "No display name"}</div>
                  </button>
                  <Link className="buttonLike" href={`/vehicle/${encodeURIComponent(vehicle.plateNumber)}`}>
                    Detail
                  </Link>
                </div>

                <div className="muted">{vehicle.road || "Road unknown"}</div>
                <div className="muted">{vehicle.city || "City unknown"}</div>
                <div className="muted">
                  Speed: {vehicle.speedKmh === null ? "-" : `${formatNumber(vehicle.speedKmh, 1)} km/h`}
                </div>
                <div className="muted">Last update: {ageFromNow(vehicle.lastServerTimestamp)}</div>
                {vehicle.locationWarning && <div className="badge warn">Location parse issue</div>}
              </article>
            ))}
          </div>
        </div>
      </aside>

      <section className="fleetMapStack">
        {selectedVehicle && (
          <div className="panel selectedVehiclePanel">
            <h2>{selectedVehicle.plateNumber}</h2>
            <div className="muted">{selectedVehicle.displayName || "No display name"}</div>
            <div className="muted selectedVehicleTimestamp">
              Server timestamp: {formatDateTime(selectedVehicle.lastServerTimestamp)}
            </div>
          </div>
        )}
        <FleetMap
          vehicles={filtered}
          selectedPlate={selectedPlate}
          onSelectPlate={(plate) => setSelectedPlate(plate)}
        />
      </section>
    </section>
  );
}
