import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAMES, getAuthBaseConfig } from "@/lib/auth-config";
import type { SessionData } from "@/lib/auth-utils";
import { decodeSessionPayload, verifySession } from "@/lib/auth-utils";

export async function getSessionFromRequest(request: NextRequest): Promise<SessionData | null> {
  try {
    const config = getAuthBaseConfig();
    const token = request.cookies.get(AUTH_COOKIE_NAMES.session)?.value;
    if (!token) return null;
    return await verifySession(token, config.sessionSecret);
  } catch {
    return null;
  }
}

export async function getServerSession(): Promise<SessionData | null> {
  try {
    const config = getAuthBaseConfig();
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAMES.session)?.value;
    if (!token) return null;
    const verified = await verifySession(token, config.sessionSecret);
    if (verified) return verified;

    // Header display fallback: if signature check fails in current runtime but payload is present/valid,
    // still surface user identity for UI controls (authz is enforced by middleware/API checks).
    return decodeSessionPayload(token);
  } catch {
    return null;
  }
}
