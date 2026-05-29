"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { anchorSchema } from "@/lib/pins/anchor";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const bodySchema = z.string().trim().min(1).max(4000);
const tokenSchema = z.string().min(1).max(128);
const uuidSchema = z.string().uuid();

const createPinInput = z.object({
  token: tokenSchema,
  pageId: uuidSchema,
  anchor: anchorSchema,
  body: bodySchema,
});

const createCommentInput = z.object({
  token: tokenSchema,
  pinId: uuidSchema,
  body: bodySchema,
});

export async function createPinViaShareToken(
  input: z.infer<typeof createPinInput>,
) {
  const parsed = createPinInput.parse(input);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/share/${parsed.token}`)}`);
  }

  const { error } = await supabase.rpc("add_pin_via_share_token", {
    p_token: parsed.token,
    p_page_id: parsed.pageId,
    p_anchor: parsed.anchor,
    p_body: parsed.body,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/share/${parsed.token}`);
}

export async function createCommentViaShareToken(
  input: z.infer<typeof createCommentInput>,
) {
  const parsed = createCommentInput.parse(input);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/share/${parsed.token}`)}`);
  }

  const { error } = await supabase.rpc("add_comment_via_share_token", {
    p_token: parsed.token,
    p_pin_id: parsed.pinId,
    p_body: parsed.body,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/share/${parsed.token}`);
}
