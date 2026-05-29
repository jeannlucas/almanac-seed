import type { Anchor } from "@/lib/pins/anchor";

export type Viewport = {
  scrollTop: number;
  scrollLeft: number;
  scrollWidth: number;
  scrollHeight: number;
  clientWidth: number;
  clientHeight: number;
};

export type ParentToIframeMessage =
  | { type: "parent:setMode"; mode: "idle" | "placing" }
  | { type: "parent:requestViewport" };

export type IframeToParentMessage =
  | {
      type: "iframe:ready";
      viewport: Viewport;
    }
  | {
      type: "iframe:viewport";
      viewport: Viewport;
    }
  | {
      type: "iframe:pinPlaced";
      anchor: Anchor;
      viewport: Viewport;
    };
