"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import LoadingState from "@/components/loading";
import { ageFromNow, formatDateTime, formatNumber } from "@/lib/format";
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

  const fetchVehicles = useCallback(async () => {
    const params = new URLSearchParams();
    if (activeOnly) params.set("activeWithinMinutes", "30");

    const response = await fetch(`/api/vehicles/current?${params.toString()}`, {
      cache: "no-store"
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? "Failed to fetch vehicles");
    }

    const data = (await response.json()) as CurrentResponse;
    setVehicles(data.vehicles);

    if (!selectedPlate && data.vehicles.length > 0) {
      setSelectedPlate(data.vehicles[0].plateNumber);
    }
  }, [activeOnly, selectedPlate]);

  useEffect(() => {
    let cancelled = false;

    const run = async (): Promise<void> => {
      try {
        setLoading(true);
        setError(null);
        await fetchVehicles();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();

    const intervalMs = Math.max(3000, publicEnv.pollIntervalSec * 1000);
    const timer = setInterval(() => {
      fetchVehicles().catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      });
    }, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
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

  return (
    <section className="pageGrid">
      <aside className="panel" style={{ padding: 12 }}>
        <div className="controls">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search plate or display name"
          />
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(event) => setActiveOnly(event.target.checked)}
              style={{ width: 18, height: 18 }}
            />
            Active in last 30 minutes
          </label>
          <button type="button" onClick={() => fetchVehicles().catch(() => undefined)}>
            Refresh
          </button>
        </div>

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
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setSelectedPlate(vehicle.plateNumber)}
                  style={{ flex: 1, textAlign: "left" }}
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
      </aside>

      <section style={{ display: "grid", gap: 12 }}>
        {selectedVehicle && (
          <div className="panel" style={{ padding: 12 }}>
            <h2>{selectedVehicle.plateNumber}</h2>
            <div className="muted">{selectedVehicle.displayName || "No display name"}</div>
            <div className="muted" style={{ marginTop: 6 }}>
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
