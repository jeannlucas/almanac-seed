"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";

import type { Dictionary } from "@/lib/i18n/dictionary";

type Props = {
  position: { left: number; top: number };
  submitting: boolean;
  onSubmit: (body: string) => Promise<void> | void;
  onCancel: () => void;
  t: Dictionary["editor"]["popover"];
};

export function PinPopover({
  position,
  submitting,
  onSubmit,
  onCancel,
  t,
}: Props) {
  const [body, setBody] = useState("");
  const disabled = submitting || body.trim().length === 0;

  return (
    <div
      className="absolute z-30 w-80 -translate-x-1/2 rounded-2xl border border-zinc-800 bg-zinc-950/95 p-3 shadow-2xl shadow-black/60 backdrop-blur"
      style={{ left: position.left, top: position.top + 16 }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-zinc-800 bg-zinc-950/95"
      />
      <textarea
        autoFocus
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={3}
        maxLength={4000}
        placeholder={t.placeholder}
        className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 shadow-inner shadow-black/30 transition focus:border-brand-via/60 focus:outline-none focus:ring-2 focus:ring-brand-via/20"
      />
      <div className="mt-2 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-full px-3 py-1 text-xs text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100 disabled:opacity-60"
        >
          {t.cancel}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSubmit(body.trim())}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-zinc-950 shadow-[0_8px_22px_-8px_rgba(168,85,247,0.6)] ring-1 ring-white/10 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              {t.saving}
            </>
          ) : (
            <>
              <Send className="h-3 w-3" />
              {t.save}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
