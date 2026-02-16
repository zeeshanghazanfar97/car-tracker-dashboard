import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAMES, getOidcConfig } from "@/lib/auth-config";
import { setSessionCookie } from "@/lib/auth-cookie";
import { parseJwtPayload, sanitizeCallbackUrl, signSession } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

function clearTransientCookies(response: NextResponse): void {
  response.cookies.delete(AUTH_COOKIE_NAMES.state);
  response.cookies.delete(AUTH_COOKIE_NAMES.nonce);
  response.cookies.delete(AUTH_COOKIE_NAMES.verifier);
  response.cookies.delete(AUTH_COOKIE_NAMES.callbackUrl);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const config = getOidcConfig();

  try {
    const authError = request.nextUrl.searchParams.get("error");
    if (authError) {
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(authError)}`, config.appBaseUrl));
    }

    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");

    const expectedState = request.cookies.get(AUTH_COOKIE_NAMES.state)?.value ?? "";
    const verifier = request.cookies.get(AUTH_COOKIE_NAMES.verifier)?.value ?? "";
    const expectedNonce = request.cookies.get(AUTH_COOKIE_NAMES.nonce)?.value ?? "";
    const callbackUrl = sanitizeCallbackUrl(request.cookies.get(AUTH_COOKIE_NAMES.callbackUrl)?.value);

    if (!code || !state || !expectedState || state !== expectedState || !verifier) {
      return NextResponse.redirect(new URL("/login?error=invalid_callback", config.appBaseUrl));
    }

    const redirectUri = `${config.appBaseUrl}${config.redirectPath}`;
    const tokenResponse = await fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code_verifier: verifier
      })
    });

    const tokenData = (await tokenResponse.json()) as {
      access_token?: string;
      id_token?: string;
      expires_in?: number;
      token_type?: string;
      error?: string;
      error_description?: string;
    };

    if (!tokenResponse.ok || (!tokenData.access_token && !tokenData.id_token)) {
      const message = tokenData.error_description || tokenData.error || "token_exchange_failed";
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, config.appBaseUrl));
    }

    let claims: Record<string, unknown> = {};
    if (tokenData.id_token) {
      claims = parseJwtPayload(tokenData.id_token);
      const nonce = typeof claims.nonce === "string" ? claims.nonce : null;
      if (nonce && nonce !== expectedNonce) {
        return NextResponse.redirect(new URL("/login?error=invalid_nonce", config.appBaseUrl));
      }
    }

    let userinfo: Record<string, unknown> = {};
    if (tokenData.access_token) {
      const userinfoResponse = await fetch(config.userinfoUrl, {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`
        }
      });

      if (userinfoResponse.ok) {
        userinfo = (await userinfoResponse.json()) as Record<string, unknown>;
      }
    }

    const merged = { ...claims, ...userinfo };
    const sub =
      typeof merged.sub === "string"
        ? merged.sub
        : typeof claims.sub === "string"
          ? claims.sub
          : null;

    if (!sub) {
      return NextResponse.redirect(new URL("/login?error=missing_subject", config.appBaseUrl));
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const sessionToken = await signSession(
      {
        iat: nowSec,
        exp: nowSec + config.sessionTtlSec,
        user: {
          sub,
          name: typeof merged.name === "string" ? merged.name : null,
          email: typeof merged.email === "string" ? merged.email : null,
          preferredUsername:
            typeof merged.preferred_username === "string"
              ? merged.preferred_username
              : typeof merged.preferredUsername === "string"
                ? merged.preferredUsername
                : null
        }
      },
      config.sessionSecret
    );

    const response = NextResponse.redirect(new URL(callbackUrl, config.appBaseUrl));
    setSessionCookie(response, sessionToken, {
      appBaseUrl: config.appBaseUrl,
      maxAgeSec: config.sessionTtlSec
    });

    clearTransientCookies(response);
    return response;
  } catch (error) {
    console.error("GET /api/auth/callback error", error);
    return NextResponse.redirect(new URL("/login?error=callback_exception", config.appBaseUrl));
  }
}
