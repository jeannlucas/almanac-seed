import { notFound } from "next/navigation";

import { Editor } from "@/components/editor/Editor";
import {
  createCommentViaShareToken,
  createPinViaShareToken,
} from "@/app/share/[token]/actions";
import { getOptionalUser } from "@/lib/auth/require-user";
import { getSiteUrl } from "@/lib/env";
import type { Anchor } from "@/lib/pins/anchor";
import { createSupabaseAnonServerClient } from "@/lib/supabase/server";
import type {
  Comment,
  Page,
  Pin,
  ProfileLite,
  Project,
  ShareBundle,
} from "@/lib/types/db";

type RouteProps = {
  params: Promise<{ token: string }>;
};

export default async function SharePage({ params }: RouteProps) {
  const { token } = await params;

  const anon = await createSupabaseAnonServerClient();
  const { data, error } = await anon.rpc("get_project_by_share_token", {
    p_token: token,
  });

  if (error || !data) {
    notFound();
  }

  const bundle = data as ShareBundle | null;
  if (!bundle || !bundle.project) {
    notFound();
  }

  const page = bundle.pages[0];
  if (!page) {
    notFound();
  }

  const pinsForPage = bundle.pins.filter((pin) => pin.page_id === page.id);
  const pinIds = new Set(pinsForPage.map((pin) => pin.id));
  const commentsForPage = bundle.comments.filter((c) =>
    pinIds.has(c.pin_id),
  );

  const { user } = await getOptionalUser();
  const shareUrl = `${getSiteUrl()}/share/${token}`;

  async function createPin(input: {
    pageId: string;
    anchor: Anchor;
    body: string;
  }) {
    "use server";
    await createPinViaShareToken({
      token,
      pageId: input.pageId,
      anchor: input.anchor,
      body: input.body,
    });
  }

  async function createComment(input: { pinId: string; body: string }) {
    "use server";
    await createCommentViaShareToken({
      token,
      pinId: input.pinId,
      body: input.body,
    });
  }

  return (
    <Editor
      mode={{ kind: "public", project: bundle.project as Project, shareToken: token }}
      page={page as Page}
      pins={pinsForPage as Pin[]}
      comments={commentsForPage as Comment[]}
      profiles={(bundle.profiles ?? []) as ProfileLite[]}
      shareUrl={shareUrl}
      isAuthenticated={Boolean(user)}
      createPin={createPin}
      createComment={createComment}
      resolvePin={null}
    />
  );
}
