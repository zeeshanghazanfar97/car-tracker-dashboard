import { NextRequest, NextResponse } from "next/server";
import { getAuthBaseConfig, getLocalAuthConfig } from "@/lib/auth-config";
import { setSessionCookie } from "@/lib/auth-cookie";
import { sanitizeCallbackUrl, signSession } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

function loginRedirect(appBaseUrl: string, callbackUrl: string, error: string): NextResponse {
  const url = new URL("/login", appBaseUrl);
  url.searchParams.set("callbackUrl", callbackUrl);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const authBase = getAuthBaseConfig();
    const local = getLocalAuthConfig();

    const form = await request.formData();
    const username = String(form.get("username") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const callbackUrl = sanitizeCallbackUrl(String(form.get("callbackUrl") ?? "/"));

    if (!local.enabled) {
      return loginRedirect(authBase.appBaseUrl, callbackUrl, "local_auth_not_configured");
    }

    if (username !== local.username || password !== local.password) {
      return loginRedirect(authBase.appBaseUrl, callbackUrl, "invalid_credentials");
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const sessionToken = await signSession(
      {
        iat: nowSec,
        exp: nowSec + authBase.sessionTtlSec,
        user: {
          sub: `local:${local.username}`,
          name: local.displayName ?? local.username,
          email: null,
          preferredUsername: local.username
        }
      },
      authBase.sessionSecret
    );

    const response = NextResponse.redirect(new URL(callbackUrl, authBase.appBaseUrl), 303);
    setSessionCookie(response, sessionToken, {
      appBaseUrl: authBase.appBaseUrl,
      maxAgeSec: authBase.sessionTtlSec
    });

    return response;
  } catch (error) {
    console.error("POST /api/auth/password error", error);
    return NextResponse.json({ error: "password_login_failed" }, { status: 500 });
  }
}
