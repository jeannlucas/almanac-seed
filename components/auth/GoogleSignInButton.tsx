"use client";

import { useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Props = {
  redirectTo?: string;
  label?: string;
};

export function GoogleSignInButton({ redirectTo, label }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const callbackTarget = redirectTo
      ? `${origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`
      : `${origin}/auth/callback`;

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackTarget },
    });
    if (oauthError) {
      setError(oauthError.message);
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-neutral-700 disabled:opacity-60"
      >
        {loading ? "Redirecting..." : (label ?? "Continue with Google")}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
