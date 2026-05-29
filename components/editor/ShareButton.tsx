"use client";

import { useState } from "react";

type Props = {
  shareUrl: string;
};

export function ShareButton({ shareUrl }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy share link", shareUrl);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100"
    >
      {copied ? "Link copied!" : "Copy share link"}
    </button>
  );
}
