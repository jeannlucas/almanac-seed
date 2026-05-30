"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";

import type { Dictionary } from "@/lib/i18n/dictionary";

type Props = {
  shareUrl: string;
  t: Dictionary["editor"]["share"];
};

export function ShareButton({ shareUrl, t }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(t.copy, shareUrl);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
        copied
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
          : "border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-brand-via/40 hover:text-brand-via",
      ].join(" ")}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5" />
          {t.copied}
        </>
      ) : (
        <>
          <Link2 className="h-3.5 w-3.5" />
          {t.copy}
        </>
      )}
    </button>
  );
}
