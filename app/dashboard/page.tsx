import { Clock4, Folder } from "lucide-react";

import { AppBackground } from "@/components/app/AppBackground";
import { AppHeader } from "@/components/app/AppHeader";
import { NewProjectForm } from "@/components/dashboard/NewProjectForm";
import { ProjectList } from "@/components/dashboard/ProjectList";
import { requireUser } from "@/lib/auth/require-user";
import { dictionary } from "@/lib/i18n/dictionary";
import { getLang } from "@/lib/i18n/server";

export default async function DashboardPage() {
  const { user, supabase } = await requireUser();

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, name, status, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const projectList = projects ?? [];
  const lang = await getLang();
  const t = dictionary[lang];
  const fullName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    null;
  const avatarUrl =
    (user.user_metadata?.avatar_url as string | undefined) ??
    (user.user_metadata?.picture as string | undefined) ??
    null;
  const firstName = fullName?.split(" ")[0] ?? null;
  const greeting = firstName
    ? t.dashboard.greetingNamed(firstName)
    : t.dashboard.greetingAnon;

  const countText =
    projectList.length === 0
      ? t.dashboard.countZero
      : projectList.length === 1
        ? t.dashboard.countOne
        : t.dashboard.countMany(projectList.length);

  return (
    <>
      <AppBackground />
      <div className="flex min-h-screen flex-col">
        <AppHeader
          t={t}
          lang={lang}
          email={user.email ?? ""}
          fullName={fullName}
          avatarUrl={avatarUrl}
        />

        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
          <section className="mb-10">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-via">
              {t.dashboard.kicker}
            </p>
            <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
              {greeting}.
            </h1>
            <p className="mt-2 text-sm text-zinc-400">{countText}</p>
          </section>

          <div className="grid gap-8 lg:grid-cols-[1.1fr,1fr]">
            <section>
              <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">
                <Folder className="h-3.5 w-3.5" />
                {t.dashboard.recent}
                <span className="ml-auto inline-flex items-center gap-1 text-zinc-500 normal-case tracking-normal">
                  <Clock4 className="h-3 w-3" />
                  {t.dashboard.recentHint}
                </span>
              </div>
              <ProjectList projects={projectList} t={t} lang={lang} />
            </section>

            <section>
              <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">
                {t.dashboard.newProject}
              </div>
              <NewProjectForm t={t.dashboard.form} />
            </section>
          </div>
        </main>
      </div>
    </>
  );
}
