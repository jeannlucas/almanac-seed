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
        return (
          <button
            key={pin.id}
            type="button"
            onClick={() => onSelectPin(pin.id)}
            className={`pointer-events-auto absolute -translate-x-1/2 -translate-y-full rounded-full px-2 py-1 text-xs font-semibold shadow ${
              pin.resolved
                ? "bg-emerald-500 text-white"
                : pin.selected
                  ? "bg-amber-400 text-neutral-900 ring-2 ring-amber-600"
                  : "bg-amber-300 text-neutral-900 hover:bg-amber-400"
            }`}
            style={{ left, top }}
            aria-label={`Pin ${pin.index}`}
          >
            {pin.index}
          </button>
        );
      })}

      {draftPosition ? (
        <div
          className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-500 bg-amber-200"
          style={{
            left: draftPosition.xPct * viewport.scrollWidth - viewport.scrollLeft,
            top: draftPosition.yPct * viewport.scrollHeight - viewport.scrollTop,
          }}
        />
      ) : null}
    </div>
  );
}
