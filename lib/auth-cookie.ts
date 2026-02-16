import type { NextResponse } from "next/server";
import { AUTH_COOKIE_NAMES } from "@/lib/auth-config";

interface SessionCookieOptions {
  appBaseUrl: string;
  maxAgeSec: number;
}

export function setSessionCookie(
  response: NextResponse,
  sessionToken: string,
  options: SessionCookieOptions
): void {
  response.cookies.set(AUTH_COOKIE_NAMES.session, sessionToken, {
    httpOnly: true,
    secure: options.appBaseUrl.startsWith("https://"),
    sameSite: "lax",
    maxAge: options.maxAgeSec,
    path: "/"
  });
}
