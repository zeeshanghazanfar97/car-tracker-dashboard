import Link from "next/link";

interface AuthControlsProps {
  userLabel: string | null;
}

export default function AuthControls({ userLabel }: AuthControlsProps) {
  if (!userLabel) {
    return (
      <Link href="/login" className="buttonLike secondary">
        Sign In
      </Link>
    );
  }

  return (
    <div className="authControlGroup">
      <span className="muted">{userLabel}</span>
      <a href="/api/auth/logout" className="buttonLike secondary">
        Sign Out
      </a>
    </div>
  );
}
