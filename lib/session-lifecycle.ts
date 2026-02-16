import type { SessionData } from "@/lib/auth-utils";

export function shouldRefreshSession(
  session: SessionData,
  refreshThresholdSec: number,
  nowSec = Math.floor(Date.now() / 1000)
): boolean {
  return session.exp - nowSec <= refreshThresholdSec;
}

export function rotateSessionPayload(
  session: SessionData,
  sessionTtlSec: number,
  nowSec = Math.floor(Date.now() / 1000)
): SessionData {
  return {
    ...session,
    iat: nowSec,
    exp: nowSec + sessionTtlSec
  };
}
