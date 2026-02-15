import { getLocalAuthConfig } from "@/lib/auth-config";

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function sanitizeCallbackUrl(value: string | undefined): string {
  if (!value) return "/";
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//")) return "/";
  return value;
}

function humanizeError(error: string | undefined): string | null {
  if (!error) return null;

  switch (error) {
    case "invalid_credentials":
      return "Invalid username or password.";
    case "local_auth_not_configured":
      return "Local admin login is not configured.";
    case "invalid_callback":
      return "Login callback validation failed. Please try again.";
    case "invalid_nonce":
      return "Identity provider nonce validation failed.";
    default:
      return `Authentication error: ${error}`;
  }
}

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const callbackUrl = sanitizeCallbackUrl(firstParam(params.callbackUrl));
  const error = humanizeError(firstParam(params.error));

  const ssoHref = `/api/auth/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  const localAuth = getLocalAuthConfig();

  return (
    <section className="authShell">
      <div className="authCard">
        <div className="authHeading">
          <h2>Secure Access</h2>
          <p>Sign in with administrator credentials or your enterprise SSO provider.</p>
        </div>

        {error && <p className="badge warn authError">{error}</p>}

        <div className="authGrid">
          <form method="post" action="/api/auth/password" className="authPane authPanePassword">
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
            <h3>Admin Login</h3>
            <p className="muted">Use local administrator credentials defined in environment variables.</p>

            <label className="authLabel">
              Username
              <input
                name="username"
                autoComplete="username"
                placeholder="admin"
                required
                disabled={!localAuth.enabled}
              />
            </label>

            <label className="authLabel">
              Password
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                placeholder="Enter password"
                required
                disabled={!localAuth.enabled}
              />
            </label>

            <button type="submit" disabled={!localAuth.enabled}>
              Sign In with Password
            </button>

            {!localAuth.enabled && (
              <p className="muted">Set `LOCAL_AUTH_USERNAME` and `LOCAL_AUTH_PASSWORD` in `.env`.</p>
            )}
          </form>

          <div className="authPane authPaneSso">
            <h3>Single Sign-On</h3>
            <p className="muted">Continue using OpenID Connect / OAuth2 with your external identity provider.</p>
            <a href={ssoHref} className="buttonLike authSsoButton">
              Continue with SSO
            </a>
            <p className="muted">Recommended for day-to-day user access and centralized account control.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
