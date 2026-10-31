"use client";

import { useEffect } from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Robotronix portal error", error);
    const report=async()=>{
      const client=getSupabaseBrowserClient();
      const {data}=client?await client.auth.getSession():{data:{session:null}};
      if(!data.session?.access_token)return;
      await fetch("/api/client-error", {
        method: "POST",
        headers: { "Content-Type": "application/json",Authorization:`Bearer ${data.session.access_token}` },
        body: JSON.stringify({ name: error.name, digest: error.digest ?? "", path: window.location.pathname }),
        keepalive: true,
      });
    };
    void report().catch(() => undefined);
  }, [error]);

  return <main className="loginShell"><section className="card"><h1>Something went wrong</h1><p>The portal could not complete this request. Please try again. If the issue continues, contact the Robotronix administrator.</p><button className="button" onClick={reset}>Try again</button></section></main>;
}
