import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAMES, getAuthBaseConfig } from "@/lib/auth-config";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest): Promise<NextResponse> {
  const base = getAuthBaseConfig();
  const secure = base.appBaseUrl.startsWith("https://");
  const endSessionUrl = process.env.OIDC_END_SESSION_URL?.trim() || null;

  const defaultRedirect = new URL("/login", base.appBaseUrl);

  if (endSessionUrl) {
    const endSession = new URL(endSessionUrl);
    endSession.searchParams.set("post_logout_redirect_uri", `${base.appBaseUrl}/login`);

    const response = NextResponse.redirect(endSession);
    response.cookies.set(AUTH_COOKIE_NAMES.session, "", {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 0
    });
    return response;
  }

  const response = NextResponse.redirect(defaultRedirect);
  response.cookies.set(AUTH_COOKIE_NAMES.session, "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
  return response;
}
