"use client";

import { useState } from "react";

type Props = {
  position: { left: number; top: number };
  submitting: boolean;
  onSubmit: (body: string) => Promise<void> | void;
  onCancel: () => void;
};

export function PinPopover({ position, submitting, onSubmit, onCancel }: Props) {
  const [body, setBody] = useState("");

  return (
    <div
      className="absolute z-30 w-72 -translate-x-1/2 rounded-lg border border-neutral-200 bg-white p-3 shadow-lg"
      style={{ left: position.left, top: position.top + 12 }}
    >
      <textarea
        autoFocus
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={3}
        maxLength={4000}
        placeholder="Leave a comment..."
        className="w-full resize-none rounded-md border border-neutral-300 px-2 py-1.5 text-sm focus:border-neutral-900 focus:outline-none"
      />
      <div className="mt-2 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-md px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={submitting || body.trim().length === 0}
          onClick={() => onSubmit(body.trim())}
          className="rounded-md bg-neutral-900 px-3 py-1 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-60"
        >
          {submitting ? "Saving..." : "Save pin"}
        </button>
      </div>
    </div>
  );
}
