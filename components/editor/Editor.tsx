"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CommentSidebar } from "@/components/editor/CommentSidebar";
import { PageFrame } from "@/components/editor/PageFrame";
import { PinPopover } from "@/components/editor/PinPopover";
import { PinsOverlay, type OverlayPin } from "@/components/editor/PinsOverlay";
import { ShareButton } from "@/components/editor/ShareButton";
import type { Anchor } from "@/lib/pins/anchor";
import type { IframeToParentMessage, Viewport } from "@/lib/pins/messages";
import type { Comment, Page, Pin, ProfileLite, Project } from "@/lib/types/db";

type EditorMode =
  | { kind: "owner"; project: Project }
  | { kind: "public"; project: Project; shareToken: string };

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
};

type DraftPin = {
  anchor: Anchor;
  position: { left: number; top: number };
  viewportSnapshot: Viewport;
};

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
      setError(err instanceof Error ? err.message : "Failed to save pin");
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

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-2">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold">{mode.project.name}</h1>
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs uppercase tracking-wide text-neutral-600">
            {mode.kind === "owner" ? "Owner" : "Shared view"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleMode}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              placing
                ? "bg-amber-400 text-neutral-900"
                : "bg-neutral-900 text-white hover:bg-neutral-700"
            }`}
          >
            {placing ? "Click on page..." : "Add pin"}
          </button>
          {mode.kind === "owner" ? <ShareButton shareUrl={shareUrl} /> : null}
          {mode.kind === "owner" ? (
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100"
              >
                Sign out
              </button>
            </form>
          ) : null}
        </div>
      </header>

      {error ? (
        <div className="border-b border-red-200 bg-red-50 px-4 py-1 text-xs text-red-700">
          {error}
        </div>
      ) : null}

      <div className="flex flex-1 overflow-hidden">
        <div className="relative flex-1 overflow-hidden bg-neutral-100">
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
            />
          ) : null}
        </div>
        <CommentSidebar
          pins={pins}
          comments={comments}
          profiles={profiles}
          selectedPinId={selectedPinId}
          canResolve={mode.kind === "owner"}
          onSelectPin={setSelectedPinId}
          onAddComment={handleAddComment}
          onResolvePin={mode.kind === "owner" && resolvePin ? handleResolvePin : null}
        />
      </div>
    </div>
  );
}
