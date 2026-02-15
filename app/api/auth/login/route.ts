import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAMES, getOidcConfig } from "@/lib/auth-config";
import { randomUrlSafeString, sanitizeCallbackUrl, sha256Base64Url } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const config = getOidcConfig();
    const state = randomUrlSafeString(24);
    const nonce = randomUrlSafeString(24);
    const verifier = randomUrlSafeString(48);
    const challenge = await sha256Base64Url(verifier);

    const callbackUrl = sanitizeCallbackUrl(request.nextUrl.searchParams.get("callbackUrl"));
    const redirectUri = `${config.appBaseUrl}${config.redirectPath}`;

    const authorization = new URL(config.authorizationUrl);
    authorization.searchParams.set("client_id", config.clientId);
    authorization.searchParams.set("redirect_uri", redirectUri);
    authorization.searchParams.set("response_type", "code");
    authorization.searchParams.set("scope", config.scope);
    authorization.searchParams.set("state", state);
    authorization.searchParams.set("nonce", nonce);
    authorization.searchParams.set("code_challenge", challenge);
    authorization.searchParams.set("code_challenge_method", "S256");

    const response = NextResponse.redirect(authorization);

    const secure = config.appBaseUrl.startsWith("https://");
    response.cookies.set(AUTH_COOKIE_NAMES.state, state, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      maxAge: 60 * 10,
      path: "/"
    });
    response.cookies.set(AUTH_COOKIE_NAMES.nonce, nonce, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      maxAge: 60 * 10,
      path: "/"
    });
    response.cookies.set(AUTH_COOKIE_NAMES.verifier, verifier, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      maxAge: 60 * 10,
      path: "/"
    });
    response.cookies.set(AUTH_COOKIE_NAMES.callbackUrl, callbackUrl, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      maxAge: 60 * 10,
      path: "/"
    });

    return response;
  } catch (error) {
    console.error("GET /api/auth/login error", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Authentication is not configured"
      },
      { status: 500 }
    );
  }
}
