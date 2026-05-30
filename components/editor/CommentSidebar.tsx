"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleDot,
  Loader2,
  MessageSquareOff,
  RotateCcw,
  Send,
} from "lucide-react";

import type { Dictionary, Lang } from "@/lib/i18n/dictionary";
import type { Comment, Pin, ProfileLite } from "@/lib/types/db";

type Props = {
  pins: Pin[];
  comments: Comment[];
  profiles: ProfileLite[];
  selectedPinId: string | null;
  canResolve: boolean;
  canComment: boolean;
  onSelectPin: (id: string | null) => void;
  onAddComment: (pinId: string, body: string) => Promise<void>;
  onResolvePin: ((pinId: string, resolved: boolean) => Promise<void>) | null;
  lang: Lang;
  t: Dictionary["editor"]["sidebar"];
};

const LOCALE_MAP: Record<Lang, string> = {
  pt: "pt-BR",
  en: "en-US",
  es: "es-ES",
};

function formatDateTime(iso: string, lang: Lang) {
  return new Intl.DateTimeFormat(LOCALE_MAP[lang], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function pinInitial(profile: ProfileLite | undefined, fallback: string) {
  const name = profile?.full_name?.trim() ?? "";
  if (name.length > 0) return name.charAt(0).toUpperCase();
  return fallback.charAt(0).toUpperCase() || "?";
}

export function CommentSidebar({
  pins,
  comments,
  profiles,
  selectedPinId,
  canResolve,
  canComment,
  onSelectPin,
  onAddComment,
  onResolvePin,
  lang,
  t,
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

  const title = t.titleTemplate.replace("{n}", String(pins.length));

  return (
    <aside className="flex h-full w-80 flex-col border-l border-zinc-800/70 bg-zinc-950 text-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-800/70 px-4 py-3">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-100">
          {title}
        </h2>
      </header>
      <div className="flex-1 overflow-y-auto">
        {pins.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-6 text-center">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/60 text-zinc-500">
              <MessageSquareOff className="h-5 w-5" />
            </span>
            <p className="text-xs text-zinc-500">{t.empty}</p>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-800/70">
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
                  canComment={canComment}
                  onSelect={() =>
                    onSelectPin(pin.id === selectedPinId ? null : pin.id)
                  }
                  onAddComment={(body) => onAddComment(pin.id, body)}
                  onResolvePin={onResolvePin}
                  lang={lang}
                  t={t}
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
  canComment: boolean;
  onSelect: () => void;
  onAddComment: (body: string) => Promise<void>;
  onResolvePin: ((pinId: string, resolved: boolean) => Promise<void>) | null;
  lang: Lang;
  t: Dictionary["editor"]["sidebar"];
};

function PinSection({
  pin,
  index,
  comments,
  profilesById,
  selected,
  canResolve,
  canComment,
  onSelect,
  onAddComment,
  onResolvePin,
  lang,
  t,
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

  const pinLabel = t.pinLabelTemplate.replace("{n}", String(index));

  return (
    <li
      className={[
        "px-4 py-4 transition",
        selected
          ? "bg-zinc-900/70"
          : "hover:bg-zinc-900/40",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="inline-flex items-center gap-2 text-sm font-medium text-zinc-100">
          <span
            className={[
              "inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ring-1",
              pin.resolved
                ? "bg-emerald-500 text-white ring-emerald-400/40"
                : selected
                  ? "bg-brand-gradient text-zinc-950 ring-brand-via/40"
                  : "bg-zinc-800 text-zinc-100 ring-zinc-700/60",
            ].join(" ")}
          >
            {index}
          </span>
          {pinLabel}
        </span>
        <span
          className={[
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
            pin.resolved
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : "border-zinc-700/60 bg-zinc-800/60 text-zinc-300",
          ].join(" ")}
        >
          {pin.resolved ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : (
            <CircleDot className="h-3 w-3" />
          )}
          {pin.resolved ? t.statusResolved : t.statusOpen}
        </span>
      </button>

      <ul className="mt-3 space-y-2">
        {comments.map((comment) => {
          const profile = comment.author_id
            ? profilesById.get(comment.author_id)
            : undefined;
          const name =
            profile?.full_name ??
            (comment.author_id ? t.member : t.deletedUser);
          const avatar = profile?.avatar_url ?? null;
          const initial = pinInitial(profile, comment.author_id ?? "?");
          return (
            <li
              key={comment.id}
              className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-3"
            >
              <div className="mb-1.5 flex items-center gap-2">
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatar}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-5 w-5 rounded-full object-cover"
                  />
                ) : (
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-gradient text-[9px] font-semibold text-zinc-950">
                    {initial}
                  </span>
                )}
                <p className="text-xs font-medium text-zinc-200">{name}</p>
                <span className="ml-auto text-[10px] tabular-nums text-zinc-500">
                  {formatDateTime(comment.created_at, lang)}
                </span>
              </div>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-100">
                {comment.body}
              </p>
            </li>
          );
        })}
      </ul>

      {canComment ? (
        <div className="mt-3 space-y-2">
          <textarea
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            rows={2}
            maxLength={4000}
            placeholder={t.replyPlaceholder}
            className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 shadow-inner shadow-black/20 transition focus:border-brand-via/60 focus:outline-none focus:ring-2 focus:ring-brand-via/20"
          />
          <div className="flex items-center justify-between gap-2">
            {canResolve && onResolvePin ? (
              <button
                type="button"
                onClick={handleResolve}
                disabled={submitting}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100 disabled:opacity-50"
              >
                {pin.resolved ? (
                  <>
                    <RotateCcw className="h-3 w-3" />
                    {t.reopen}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3 w-3" />
                    {t.resolve}
                  </>
                )}
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={handleReply}
              disabled={submitting || reply.trim().length === 0}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-zinc-950 shadow-[0_6px_18px_-6px_rgba(168,85,247,0.5)] ring-1 ring-white/10 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t.saving}
                </>
              ) : (
                <>
                  <Send className="h-3 w-3" />
                  {t.reply}
                </>
              )}
            </button>
          </div>
          {error ? (
            <p className="text-[11px] text-red-300">{error}</p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
