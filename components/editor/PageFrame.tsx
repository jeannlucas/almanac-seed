"use client";

import { forwardRef, useMemo } from "react";

import { CAPTURE_SCRIPT } from "@/components/editor/injected/capture-script";

type Props = {
  html: string;
};

function composeSrcDoc(userHtml: string) {
  const script = `<script>${CAPTURE_SCRIPT}</script>`;
  const lower = userHtml.toLowerCase();
  const closingBody = lower.lastIndexOf("</body>");
  if (closingBody !== -1) {
    return userHtml.slice(0, closingBody) + script + userHtml.slice(closingBody);
  }
  return userHtml + script;
}

export const PageFrame = forwardRef<HTMLIFrameElement, Props>(
  function PageFrame({ html }, ref) {
    const srcDoc = useMemo(() => composeSrcDoc(html), [html]);

    return (
      <iframe
        ref={ref}
        title="page"
        sandbox="allow-scripts"
        srcDoc={srcDoc}
        className="h-full w-full border-0 bg-white"
      />
    );
  },
);
