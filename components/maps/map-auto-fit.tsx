"use client";

import { latLngBounds } from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import { useMap } from "react-leaflet";

interface MapAutoFitProps {
  points: Array<[number, number]>;
  singleZoom?: number;
}

export default function MapAutoFit({ points, singleZoom = 14 }: MapAutoFitProps) {
  const map = useMap();
  const lastSignatureRef = useRef<string>("");
  const signature = useMemo(
    () => points.map((p) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`).join(";"),
    [points]
  );

  useEffect(() => {
    if (points.length === 0) return;
    if (signature === lastSignatureRef.current) return;
    lastSignatureRef.current = signature;

    if (points.length === 1) {
      map.setView(points[0], Math.max(map.getZoom(), singleZoom), {
        animate: true
      });
      return;
    }

    const bounds = latLngBounds(points);
    map.fitBounds(bounds, {
      animate: true,
      padding: [40, 40],
      maxZoom: 16
    });
  }, [map, points, signature, singleZoom]);

  return null;
}
