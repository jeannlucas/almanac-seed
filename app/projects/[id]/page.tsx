import { notFound } from "next/navigation";

import { Editor } from "@/components/editor/Editor";
import {
  createCommentAsOwner,
  createPinAsOwner,
  resolvePinAsOwner,
} from "@/app/projects/[id]/actions";
import { requireUser } from "@/lib/auth/require-user";
import { getSiteUrl } from "@/lib/env";
import type { Anchor } from "@/lib/pins/anchor";
import type {
  Comment,
  Page,
  Pin,
  ProfileLite,
  Project,
} from "@/lib/types/db";

type RouteProps = {
  params: Promise<{ id: string }>;
};

export default async function ProjectPage({ params }: RouteProps) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, status, share_token, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!project) {
    notFound();
  }

  const { data: pages } = await supabase
    .from("pages")
    .select("id, project_id, html, version, created_at")
    .eq("project_id", id)
    .order("created_at", { ascending: true })
    .limit(1);

  const page = (pages ?? [])[0];
  if (!page) {
    notFound();
  }

  const { data: pins } = await supabase
    .from("pins")
    .select("id, page_id, author_id, anchor, resolved, created_at")
    .eq("page_id", page.id)
    .order("created_at", { ascending: true });

  const pinIds = (pins ?? []).map((p) => p.id);

  const commentsResult = pinIds.length
    ? await supabase
        .from("comments")
        .select("id, pin_id, author_id, parent_id, body, created_at, edited_at")
        .in("pin_id", pinIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
    : { data: [] as Comment[] };

  const comments = (commentsResult.data ?? []) as Comment[];

  const authorIds = Array.from(
    new Set(
      [
        ...(pins ?? []).map((p) => p.author_id),
        ...comments.map((c) => c.author_id),
      ].filter((value): value is string => Boolean(value)),
    ),
  );

  let profiles: ProfileLite[] = [];
  if (authorIds.length > 0) {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", authorIds);
    profiles = data ?? [];
  }

  const shareUrl = `${getSiteUrl()}/share/${project.share_token}`;

  async function createPin(input: {
    pageId: string;
    anchor: Anchor;
    body: string;
  }) {
    "use server";
    await createPinAsOwner({ projectId: id, ...input });
  }

  async function createComment(input: { pinId: string; body: string }) {
    "use server";
    await createCommentAsOwner({ projectId: id, ...input });
  }

  async function resolvePin(input: { pinId: string; resolved: boolean }) {
    "use server";
    await resolvePinAsOwner({ projectId: id, ...input });
  }

  return (
    <Editor
      mode={{ kind: "owner", project: project as Project }}
      page={page as Page}
      pins={(pins ?? []) as Pin[]}
      comments={comments}
      profiles={profiles}
      shareUrl={shareUrl}
      isAuthenticated
      createPin={createPin}
      createComment={createComment}
      resolvePin={resolvePin}
    />
  );
}
