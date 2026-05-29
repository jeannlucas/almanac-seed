"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { anchorSchema } from "@/lib/pins/anchor";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const bodySchema = z.string().trim().min(1).max(4000);
const uuidSchema = z.string().uuid();

const createPinInput = z.object({
  projectId: uuidSchema,
  pageId: uuidSchema,
  anchor: anchorSchema,
  body: bodySchema,
});

const createCommentInput = z.object({
  projectId: uuidSchema,
  pinId: uuidSchema,
  body: bodySchema,
});

const resolvePinInput = z.object({
  projectId: uuidSchema,
  pinId: uuidSchema,
  resolved: z.boolean(),
});

async function getAuthedClient() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  return { supabase, user };
}

export async function createPinAsOwner(input: z.infer<typeof createPinInput>) {
  const parsed = createPinInput.parse(input);
  const { supabase, user } = await getAuthedClient();

  const { data: pin, error: pinError } = await supabase
    .from("pins")
    .insert({
      page_id: parsed.pageId,
      author_id: user.id,
      anchor: parsed.anchor,
    })
    .select("id")
    .single();

  if (pinError || !pin) {
    throw new Error(pinError?.message ?? "Failed to create pin");
  }

  const { error: commentError } = await supabase.from("comments").insert({
    pin_id: pin.id,
    author_id: user.id,
    body: parsed.body,
  });

  if (commentError) {
    throw new Error(commentError.message);
  }

  revalidatePath(`/projects/${parsed.projectId}`);
}

export async function createCommentAsOwner(
  input: z.infer<typeof createCommentInput>,
) {
  const parsed = createCommentInput.parse(input);
  const { supabase, user } = await getAuthedClient();

  const { error } = await supabase.from("comments").insert({
    pin_id: parsed.pinId,
    author_id: user.id,
    body: parsed.body,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/projects/${parsed.projectId}`);
}

export async function resolvePinAsOwner(
  input: z.infer<typeof resolvePinInput>,
) {
  const parsed = resolvePinInput.parse(input);
  const { supabase } = await getAuthedClient();

  const { error } = await supabase
    .from("pins")
    .update({ resolved: parsed.resolved })
    .eq("id", parsed.pinId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/projects/${parsed.projectId}`);
}
