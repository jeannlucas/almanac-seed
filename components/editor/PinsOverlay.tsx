"use client";

import type { Anchor } from "@/lib/pins/anchor";
import type { Viewport } from "@/lib/pins/messages";

export type OverlayPin = {
  id: string;
  index: number;
  anchor: Anchor;
  resolved: boolean;
  selected: boolean;
};

type Props = {
  pins: OverlayPin[];
  viewport: Viewport | null;
  placing: boolean;
  draftPosition: { xPct: number; yPct: number } | null;
  onSelectPin: (id: string) => void;
};

export function PinsOverlay({
  pins,
  viewport,
  placing,
  draftPosition,
  onSelectPin,
}: Props) {
  if (!viewport) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden={placing}
    >
      {pins.map((pin) => {
        const left = pin.anchor.xPct * viewport.scrollWidth - viewport.scrollLeft;
        const top = pin.anchor.yPct * viewport.scrollHeight - viewport.scrollTop;
        const baseClass =
          "pointer-events-auto absolute -translate-x-1/2 -translate-y-full inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-semibold ring-2 ring-white/70 transition";
        const stateClass = pin.resolved
          ? "bg-emerald-500 text-white shadow-[0_4px_14px_-2px_rgba(16,185,129,0.6)]"
          : pin.selected
            ? "bg-brand-gradient text-zinc-950 shadow-[0_6px_20px_-2px_rgba(168,85,247,0.7)] scale-110"
            : "bg-zinc-950 text-zinc-50 shadow-[0_4px_14px_-2px_rgba(0,0,0,0.6)] hover:bg-brand-via hover:text-zinc-950";
        return (
          <button
            key={pin.id}
            type="button"
            onClick={() => onSelectPin(pin.id)}
            className={`${baseClass} ${stateClass}`}
            style={{ left, top }}
            aria-label={`Pin ${pin.index}`}
          >
            {pin.index}
          </button>
        );
      })}

      {draftPosition ? (
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{
            left: draftPosition.xPct * viewport.scrollWidth - viewport.scrollLeft,
            top: draftPosition.yPct * viewport.scrollHeight - viewport.scrollTop,
          }}
        >
          <span className="relative inline-flex h-4 w-4">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-via opacity-60" />
            <span className="relative inline-flex h-4 w-4 rounded-full border-2 border-white bg-brand-via shadow-[0_0_18px_rgba(168,85,247,0.8)]" />
          </span>
        </div>
      ) : null}
    </div>
  );
}
