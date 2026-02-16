import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAMES, getAuthBaseConfig } from "@/lib/auth-config";
import { setSessionCookie } from "@/lib/auth-cookie";
import { signSession, verifySession } from "@/lib/auth-utils";
import { rotateSessionPayload, shouldRefreshSession } from "@/lib/session-lifecycle";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = getAuthBaseConfig();
    const token = request.cookies.get(AUTH_COOKIE_NAMES.session)?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await verifySession(token, auth.sessionSecret);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const response = new NextResponse(null, { status: 204 });
    if (!shouldRefreshSession(session, auth.sessionRefreshThresholdSec)) {
      return response;
    }

    const rotatedPayload = rotateSessionPayload(session, auth.sessionTtlSec);
    const rotatedToken = await signSession(rotatedPayload, auth.sessionSecret);

    setSessionCookie(response, rotatedToken, {
      appBaseUrl: auth.appBaseUrl,
      maxAgeSec: auth.sessionTtlSec
    });

    return response;
  } catch (error) {
    console.error("POST /api/auth/session/refresh error", error);
    return NextResponse.json({ error: "refresh_failed" }, { status: 500 });
  }
}
