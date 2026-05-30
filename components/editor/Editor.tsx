"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Lock,
  LogOut,
  MapPin,
  Sparkles,
  X,
} from "lucide-react";

import { CommentSidebar } from "@/components/editor/CommentSidebar";
import { PageFrame } from "@/components/editor/PageFrame";
import { PinPopover } from "@/components/editor/PinPopover";
import { PinsOverlay, type OverlayPin } from "@/components/editor/PinsOverlay";
import { ShareButton } from "@/components/editor/ShareButton";
import { LanguageToggle } from "@/components/i18n/LanguageToggle";
import type { Dictionary, Lang } from "@/lib/i18n/dictionary";
import type { Anchor } from "@/lib/pins/anchor";
import type { IframeToParentMessage, Viewport } from "@/lib/pins/messages";
import type { Comment, Page, Pin, ProfileLite, Project } from "@/lib/types/db";

type EditorMode =
  | { kind: "owner"; project: Project }
  | { kind: "public"; project: Project; shareToken: string };

type EditorUser = {
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
};

type Props = {
  mode: EditorMode;
  page: Page;
  pins: Pin[];
  comments: Comment[];
  profiles: ProfileLite[];
  shareUrl: string;
  isAuthenticated: boolean;
  createPin: (input: {
    pageId: string;
    anchor: Anchor;
    body: string;
  }) => Promise<void>;
  createComment: (input: { pinId: string; body: string }) => Promise<void>;
  resolvePin:
    | ((input: { pinId: string; resolved: boolean }) => Promise<void>)
    | null;
  lang: Lang;
  t: Dictionary["editor"];
  navT: Dictionary["nav"];
  user: EditorUser | null;
};

type DraftPin = {
  anchor: Anchor;
  position: { left: number; top: number };
  viewportSnapshot: Viewport;
};

function initialOf(value: string) {
  return value.trim().charAt(0).toUpperCase() || "?";
}

export function Editor({
  mode,
  page,
  pins,
  comments,
  profiles,
  shareUrl,
  isAuthenticated,
  createPin,
  createComment,
  resolvePin,
  lang,
  t,
  navT,
  user,
}: Props) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [placing, setPlacing] = useState(false);
  const [draft, setDraft] = useState<DraftPin | null>(null);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const postToFrame = useCallback(
    (msg: { type: "parent:setMode"; mode: "idle" | "placing" } | { type: "parent:requestViewport" }) => {
      frameRef.current?.contentWindow?.postMessage(msg, "*");
    },
    [],
  );

  useEffect(() => {
    function handleMessage(event: MessageEvent<IframeToParentMessage>) {
      if (!frameRef.current) return;
      if (event.source !== frameRef.current.contentWindow) return;

      const data = event.data;
      if (!data || typeof data !== "object") return;

      switch (data.type) {
        case "iframe:ready":
        case "iframe:viewport":
          setViewport(data.viewport);
          break;
        case "iframe:pinPlaced": {
          setViewport(data.viewport);
          setPlacing(false);
          const left =
            data.anchor.xPct * data.viewport.scrollWidth - data.viewport.scrollLeft;
          const top =
            data.anchor.yPct * data.viewport.scrollHeight - data.viewport.scrollTop;
          setDraft({
            anchor: data.anchor,
            position: { left, top },
            viewportSnapshot: data.viewport,
          });
          break;
        }
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    function onResize() {
      postToFrame({ type: "parent:requestViewport" });
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [postToFrame]);

  const overlayPins = useMemo<OverlayPin[]>(
    () =>
      pins.map((pin, idx) => ({
        id: pin.id,
        index: idx + 1,
        anchor: pin.anchor,
        resolved: pin.resolved,
        selected: pin.id === selectedPinId,
      })),
    [pins, selectedPinId],
  );

  const draftPosition = draft
    ? { xPct: draft.anchor.xPct, yPct: draft.anchor.yPct }
    : null;

  function toggleMode() {
    if (mode.kind === "public" && !isAuthenticated) {
      window.location.href = `/login?next=${encodeURIComponent(
        `/share/${mode.shareToken}`,
      )}`;
      return;
    }
    setError(null);
    setDraft(null);
    const next = !placing;
    setPlacing(next);
    postToFrame({ type: "parent:setMode", mode: next ? "placing" : "idle" });
  }

  async function handleSavePin(body: string) {
    if (!draft) return;
    setSubmitting(true);
    setError(null);
    try {
      await createPin({ pageId: page.id, anchor: draft.anchor, body });
      setDraft(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errorSavePin);
    } finally {
      setSubmitting(false);
    }
  }

  function handleCancelDraft() {
    setDraft(null);
  }

  async function handleAddComment(pinId: string, body: string) {
    await createComment({ pinId, body });
  }

  async function handleResolvePin(pinId: string, resolved: boolean) {
    if (!resolvePin) return;
    await resolvePin({ pinId, resolved });
  }

  const userDisplay = user?.fullName?.trim() || user?.email || "";
  const userInitial = user ? initialOf(userDisplay) : "?";
  const isOwner = mode.kind === "owner";
  const canComment = isAuthenticated || isOwner;

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="z-40 flex items-center justify-between border-b border-zinc-800/70 bg-zinc-950/80 px-4 py-2.5 backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          {isOwner ? (
            <Link
              href="/dashboard"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900/60 text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-100"
              aria-label={t.backToDashboard}
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          ) : (
            <Link
              href="/"
              className="group inline-flex items-center gap-2 text-sm font-semibold tracking-tight"
            >
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full bg-brand-gradient shadow-[0_0_12px_rgba(168,85,247,0.8)] transition group-hover:scale-125"
              />
              <span className="text-zinc-100">Almanac</span>
            </Link>
          )}

          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-zinc-100">
              {mode.project.name}
            </h1>
          </div>

          <span
            className={[
              "hidden items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide sm:inline-flex",
              isOwner
                ? "border-brand-via/40 bg-brand-via/10 text-brand-via"
                : "border-zinc-700/70 bg-zinc-800/60 text-zinc-300",
            ].join(" ")}
          >
            <Sparkles className="h-3 w-3" />
            {isOwner ? t.ownerBadge : t.sharedBadge}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <LanguageToggle lang={lang} compact />

          <button
            type="button"
            onClick={toggleMode}
            className={[
              "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition",
              placing
                ? "bg-brand-gradient text-zinc-950 shadow-[0_8px_30px_-8px_rgba(168,85,247,0.7)]"
                : canComment
                  ? "bg-white text-zinc-950 hover:bg-zinc-100 ring-1 ring-white/10"
                  : "border border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-700",
            ].join(" ")}
          >
            {placing ? (
              <>
                <span aria-hidden className="relative inline-flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                </span>
                {t.placingHint}
              </>
            ) : (
              <>
                {canComment ? (
                  <MapPin className="h-3.5 w-3.5" />
                ) : (
                  <Lock className="h-3.5 w-3.5" />
                )}
                {canComment ? t.addPin : t.unauthHint}
              </>
            )}
          </button>

          {isOwner ? <ShareButton shareUrl={shareUrl} t={t.share} /> : null}

          {user ? (
            <div className="hidden items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 py-1 pl-1 pr-3 text-xs text-zinc-300 sm:inline-flex">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-6 w-6 rounded-full object-cover"
                />
              ) : (
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-gradient text-[11px] font-semibold text-zinc-950">
                  {userInitial}
                </span>
              )}
              <span className="truncate max-w-[10rem]">{userDisplay}</span>
            </div>
          ) : null}

          {isOwner ? (
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{navT.signOut}</span>
              </button>
            </form>
          ) : null}
        </div>
      </header>

      {error ? (
        <div className="flex items-center gap-2 border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-300">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-200 transition hover:text-white"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      <div className="flex flex-1 overflow-hidden">
        <div className="relative flex-1 overflow-hidden bg-zinc-950 p-3">
          <div className="relative h-full w-full overflow-hidden rounded-xl border border-zinc-800/80 bg-white shadow-2xl shadow-black/40">
            <PageFrame ref={frameRef} html={page.html} />
            <PinsOverlay
              pins={overlayPins}
              viewport={viewport}
              placing={placing}
              draftPosition={draftPosition}
              onSelectPin={(id) => setSelectedPinId(id)}
            />
            {draft ? (
              <PinPopover
                position={draft.position}
                submitting={submitting}
                onSubmit={handleSavePin}
                onCancel={handleCancelDraft}
                t={t.popover}
              />
            ) : null}
          </div>
        </div>
        <CommentSidebar
          pins={pins}
          comments={comments}
          profiles={profiles}
          selectedPinId={selectedPinId}
          canResolve={isOwner}
          canComment={canComment}
          onSelectPin={setSelectedPinId}
          onAddComment={handleAddComment}
          onResolvePin={isOwner && resolvePin ? handleResolvePin : null}
          lang={lang}
          t={t.sidebar}
        />
      </div>
    </div>
  );
}
