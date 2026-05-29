"use client";

import { useMemo, useState } from "react";

import type { Comment, Pin, ProfileLite } from "@/lib/types/db";

type Props = {
  pins: Pin[];
  comments: Comment[];
  profiles: ProfileLite[];
  selectedPinId: string | null;
  canResolve: boolean;
  onSelectPin: (id: string | null) => void;
  onAddComment: (pinId: string, body: string) => Promise<void>;
  onResolvePin: ((pinId: string, resolved: boolean) => Promise<void>) | null;
};

export function CommentSidebar({
  pins,
  comments,
  profiles,
  selectedPinId,
  canResolve,
  onSelectPin,
  onAddComment,
  onResolvePin,
}: Props) {
  const profilesById = useMemo(() => {
    const map = new Map<string, ProfileLite>();
    for (const profile of profiles) map.set(profile.id, profile);
    return map;
  }, [profiles]);

  const commentsByPin = useMemo(() => {
    const map = new Map<string, Comment[]>();
    for (const comment of comments) {
      const arr = map.get(comment.pin_id) ?? [];
      arr.push(comment);
      map.set(comment.pin_id, arr);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.created_at.localeCompare(b.created_at));
    }
    return map;
  }, [comments]);

  return (
    <aside className="flex h-full w-80 flex-col border-l border-neutral-200 bg-white">
      <header className="border-b border-neutral-200 px-4 py-3">
        <h2 className="text-sm font-semibold">Pins ({pins.length})</h2>
      </header>
      <div className="flex-1 overflow-y-auto">
        {pins.length === 0 ? (
          <p className="p-4 text-sm text-neutral-500">
            No pins yet. Use “Add pin” and click on the page.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {pins.map((pin, index) => {
              const pinComments = commentsByPin.get(pin.id) ?? [];
              return (
                <PinSection
                  key={pin.id}
                  pin={pin}
                  index={index + 1}
                  comments={pinComments}
                  profilesById={profilesById}
                  selected={pin.id === selectedPinId}
                  canResolve={canResolve}
                  onSelect={() =>
                    onSelectPin(pin.id === selectedPinId ? null : pin.id)
                  }
                  onAddComment={(body) => onAddComment(pin.id, body)}
                  onResolvePin={onResolvePin}
                />
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}

type PinSectionProps = {
  pin: Pin;
  index: number;
  comments: Comment[];
  profilesById: Map<string, ProfileLite>;
  selected: boolean;
  canResolve: boolean;
  onSelect: () => void;
  onAddComment: (body: string) => Promise<void>;
  onResolvePin: ((pinId: string, resolved: boolean) => Promise<void>) | null;
};

function PinSection({
  pin,
  index,
  comments,
  profilesById,
  selected,
  canResolve,
  onSelect,
  onAddComment,
  onResolvePin,
}: PinSectionProps) {
  const [reply, setReply] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReply() {
    if (reply.trim().length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await onAddComment(reply.trim());
      setReply("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to comment");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResolve() {
    if (!onResolvePin) return;
    setSubmitting(true);
    setError(null);
    try {
      await onResolvePin(pin.id, !pin.resolved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update pin");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <li className={`p-4 ${selected ? "bg-amber-50" : ""}`}>
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <span
            className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold ${
              pin.resolved ? "bg-emerald-500 text-white" : "bg-amber-300"
            }`}
          >
            {index}
          </span>
          Pin {index}
        </span>
        <span className="text-xs text-neutral-500">
          {pin.resolved ? "Resolved" : "Open"}
        </span>
      </button>

      <ul className="mt-3 space-y-2">
        {comments.map((comment) => {
          const profile = comment.author_id
            ? profilesById.get(comment.author_id)
            : undefined;
          const name = profile?.full_name ?? (comment.author_id ? "Member" : "Deleted user");
          return (
            <li key={comment.id} className="rounded-md bg-neutral-50 p-2">
              <p className="text-xs font-medium text-neutral-700">{name}</p>
              <p className="whitespace-pre-wrap text-sm text-neutral-800">
                {comment.body}
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-wide text-neutral-400">
                {new Date(comment.created_at).toLocaleString()}
              </p>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 space-y-2">
        <textarea
          value={reply}
          onChange={(event) => setReply(event.target.value)}
          rows={2}
          maxLength={4000}
          placeholder="Reply..."
          className="w-full resize-none rounded-md border border-neutral-300 px-2 py-1.5 text-xs focus:border-neutral-900 focus:outline-none"
        />
        <div className="flex items-center justify-between">
          {canResolve && onResolvePin ? (
            <button
              type="button"
              onClick={handleResolve}
              disabled={submitting}
              className="text-xs text-neutral-600 underline disabled:opacity-50"
            >
              {pin.resolved ? "Reopen" : "Resolve"}
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={handleReply}
            disabled={submitting || reply.trim().length === 0}
            className="rounded-md bg-neutral-900 px-3 py-1 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-60"
          >
            {submitting ? "Saving..." : "Reply"}
          </button>
        </div>
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </div>
    </li>
  );
}
