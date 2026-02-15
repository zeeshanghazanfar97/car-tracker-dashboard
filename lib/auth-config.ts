export interface OidcConfig {
  appBaseUrl: string;
  sessionSecret: string;
  sessionTtlSec: number;
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
  endSessionUrl: string | null;
  scope: string;
  redirectPath: string;
}

export interface AuthBaseConfig {
  appBaseUrl: string;
  sessionSecret: string;
  sessionTtlSec: number;
}

export interface LocalAuthConfig {
  enabled: boolean;
  username: string;
  password: string;
  displayName: string | null;
}

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function required(name: string, value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return trimmed;
}

export function getOidcConfig(): OidcConfig {
  const base = getAuthBaseConfig();

  return {
    ...base,
    clientId: required("OIDC_CLIENT_ID", process.env.OIDC_CLIENT_ID),
    clientSecret: required("OIDC_CLIENT_SECRET", process.env.OIDC_CLIENT_SECRET),
    authorizationUrl: required("OIDC_AUTHORIZATION_URL", process.env.OIDC_AUTHORIZATION_URL),
    tokenUrl: required("OIDC_TOKEN_URL", process.env.OIDC_TOKEN_URL),
    userinfoUrl: required("OIDC_USERINFO_URL", process.env.OIDC_USERINFO_URL),
    endSessionUrl: process.env.OIDC_END_SESSION_URL?.trim() || null,
    scope: process.env.OIDC_SCOPE?.trim() || "openid profile email",
    redirectPath: process.env.OIDC_REDIRECT_PATH?.trim() || "/api/auth/callback"
  };
}

export function getAuthBaseConfig(): AuthBaseConfig {
  return {
    appBaseUrl: required("AUTH_APP_BASE_URL", process.env.AUTH_APP_BASE_URL),
    sessionSecret: required("AUTH_SESSION_SECRET", process.env.AUTH_SESSION_SECRET),
    sessionTtlSec: parseNumber(process.env.AUTH_SESSION_TTL_SEC, 60 * 60 * 8)
  };
}

export function getLocalAuthConfig(): LocalAuthConfig {
  const username = process.env.LOCAL_AUTH_USERNAME?.trim() ?? "";
  const password = process.env.LOCAL_AUTH_PASSWORD ?? "";
  const displayName = process.env.LOCAL_AUTH_DISPLAY_NAME?.trim() || null;

  return {
    enabled: username.length > 0 && password.length > 0,
    username,
    password,
    displayName
  };
}

export const AUTH_COOKIE_NAMES = {
  session: "ctd_session",
  state: "ctd_oidc_state",
  nonce: "ctd_oidc_nonce",
  verifier: "ctd_oidc_verifier",
  callbackUrl: "ctd_oidc_callback"
} as const;
