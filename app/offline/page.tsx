import Link from "next/link";

export default function OfflinePage() {
  return (
    <section className="offlineShell">
      <article className="offlineCard">
        <h2>You Are Offline</h2>
        <p className="muted">
          The dashboard can be opened, but live vehicle data requires a network connection.
        </p>
        <div className="offlineActions">
          <a className="buttonLike" href="/">
            Retry Connection
          </a>
          <Link className="buttonLike secondary" href="/">
            Back To Dashboard
          </Link>
        </div>
      </article>
    </section>
  );
}
