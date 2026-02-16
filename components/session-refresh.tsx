"use client";

import { useEffect } from "react";
import { publicEnv } from "@/lib/public-env";

interface SessionRefreshProps {
  enabled: boolean;
}

export default function SessionRefresh({ enabled }: SessionRefreshProps) {
  useEffect(() => {
    if (!enabled) return;

    let disposed = false;
    let inFlight = false;

    const refresh = async (): Promise<void> => {
      if (disposed || inFlight) return;
      inFlight = true;

      try {
        await fetch("/api/auth/session/refresh", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store"
        });
      } catch {
        // Silent fail; auth middleware/API checks still enforce access.
      } finally {
        inFlight = false;
      }
    };

    void refresh();

    const intervalMs = Math.max(60_000, Math.floor(publicEnv.sessionRefreshIntervalMin * 60 * 1000));
    const intervalId = window.setInterval(() => {
      void refresh();
    }, intervalMs);

    const onVisibility = (): void => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled]);

  return null;
}
