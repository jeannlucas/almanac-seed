"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required").max(120),
  html: z.string().min(1, "HTML content is required").max(1_000_000),
});

export type CreateProjectState = {
  error?: string;
} | undefined;

export async function createProject(
  _prev: CreateProjectState,
  formData: FormData,
): Promise<CreateProjectState> {
  const parsed = createProjectSchema.safeParse({
    name: formData.get("name"),
    html: formData.get("html"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({ name: parsed.data.name, owner_id: user.id })
    .select("id, share_token")
    .single();

  if (projectError || !project) {
    return { error: projectError?.message ?? "Failed to create project" };
  }

  const { error: pageError } = await supabase.from("pages").insert({
    project_id: project.id,
    html: parsed.data.html,
  });

  if (pageError) {
    return { error: pageError.message };
  }

  revalidatePath("/dashboard");
  redirect(`/projects/${project.id}`);
}
