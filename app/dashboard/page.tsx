import { NewProjectForm } from "@/components/dashboard/NewProjectForm";
import { ProjectList } from "@/components/dashboard/ProjectList";
import { requireUser } from "@/lib/auth/require-user";

export default async function DashboardPage() {
  const { user, supabase } = await requireUser();

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, name, status, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Your projects</h1>
          <p className="text-sm text-neutral-600">
            Signed in as {user.email}
          </p>
        </div>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100"
          >
            Sign out
          </button>
        </form>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr,1.2fr]">
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-500">
            Recent
          </h2>
          <ProjectList projects={projects ?? []} />
        </section>
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-500">
            New project
          </h2>
          <NewProjectForm />
        </section>
      </div>
    </main>
  );
}
