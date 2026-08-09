"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Root render-error boundary: reports to Sentry (no-op without a DSN)
 * and shows a minimal recovery screen. Replaces the whole document, so
 * it carries its own html/body.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#090b08",
          color: "#f2f4ee",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: 24,
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.4rem", margin: "0 0 0.5rem" }}>Something broke</h1>
          <p style={{ color: "#9aa392", fontSize: "0.95rem", margin: "0 0 1.25rem" }}>
            The error has been reported. Your logged data is safe.
          </p>
          <button
            onClick={reset}
            style={{
              background: "#bef264",
              color: "#090b08",
              fontWeight: 700,
              border: 0,
              padding: "10px 20px",
              borderRadius: 12,
              fontSize: "0.85rem",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
