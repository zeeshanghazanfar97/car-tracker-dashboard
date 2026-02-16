import { describe, expect, it } from "vitest";
import type { SessionData } from "@/lib/auth-utils";
import { rotateSessionPayload, shouldRefreshSession } from "@/lib/session-lifecycle";

function sampleSession(overrides: Partial<SessionData> = {}): SessionData {
  return {
    iat: 1000,
    exp: 2000,
    user: {
      sub: "user-1",
      name: "User One",
      email: "user@example.com",
      preferredUsername: "user1"
    },
    ...overrides
  };
}

describe("session lifecycle", () => {
  it("refreshes when remaining time is at or below threshold", () => {
    const session = sampleSession({ exp: 10_000 });
    expect(shouldRefreshSession(session, 300, 9_700)).toBe(true);
    expect(shouldRefreshSession(session, 300, 9_701)).toBe(true);
  });

  it("does not refresh when remaining time is above threshold", () => {
    const session = sampleSession({ exp: 10_000 });
    expect(shouldRefreshSession(session, 300, 9_600)).toBe(false);
  });

  it("rotates iat/exp while preserving identity payload", () => {
    const session = sampleSession({ iat: 100, exp: 200 });
    const rotated = rotateSessionPayload(session, 3600, 5000);

    expect(rotated.iat).toBe(5000);
    expect(rotated.exp).toBe(8600);
    expect(rotated.user).toEqual(session.user);
  });
});
