"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Robotronix portal error", error);
    void fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: error.name, digest: error.digest ?? "", path: window.location.pathname }),
      keepalive: true,
    }).catch(() => undefined);
  }, [error]);

  return <main className="loginShell"><section className="card"><h1>Something went wrong</h1><p>The portal could not complete this request. Please try again. If the issue continues, contact the Robotronix administrator.</p><button className="button" onClick={reset}>Try again</button></section></main>;
}
