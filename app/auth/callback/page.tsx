"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentAuthUser, getCurrentProfile } from "@/lib/repository";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Finishing your secure sign-in…");

  useEffect(() => {
    let cancelled = false;

    async function routeSignedInUser() {
      try {
        // Supabase detects the OAuth session from the callback URL in the browser.
        // Give the client a moment to persist the session before resolving the role.
        let user = await getCurrentAuthUser();
        if (!user) {
          await new Promise(resolve => setTimeout(resolve, 350));
          user = await getCurrentAuthUser();
        }

        if (cancelled) return;

        if (!user) {
          router.replace("/");
          return;
        }

        const profile = await getCurrentProfile();
        if (cancelled) return;

        if (!profile) {
          // A brand-new Google user has authenticated successfully but has not yet
          // been linked to an Admin / Trainer / Parent / Student portal profile.
          router.replace("/onboarding");
          return;
        }

        const destination = {
          admin: "/admin",
          trainer: "/trainer",
          parent: "/parent",
          student: "/student",
        }[profile.role];

        router.replace(destination ?? "/");
      } catch (error) {
        console.error("Unable to complete OAuth role routing", error);
        if (!cancelled) {
          setMessage("We could not finish signing you in. Returning to the login page…");
          window.setTimeout(() => router.replace("/"), 1200);
        }
      }
    }

    routeSignedInUser();
    return () => { cancelled = true; };
  }, [router]);

  return (
    <main className="loginShell">
      <div className="card">{message}</div>
    </main>
  );
}
