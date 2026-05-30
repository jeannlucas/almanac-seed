import Link from "next/link";
import { ArrowUpRight, FileCode2, Sparkles } from "lucide-react";

import type { Dictionary, Lang } from "@/lib/i18n/dictionary";
import type { Project, ProjectStatus } from "@/lib/types/db";

type Props = {
  projects: Pick<Project, "id" | "name" | "status" | "created_at">[];
  t: Dictionary;
  lang: Lang;
};

const STATUS_STYLES: Record<ProjectStatus, string> = {
  active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  published: "border-brand-via/40 bg-brand-via/10 text-brand-via",
  archived: "border-zinc-700/60 bg-zinc-800/60 text-zinc-400",
};

const LOCALE_MAP: Record<Lang, string> = {
  pt: "pt-BR",
  en: "en-US",
  es: "es-ES",
};

function formatDate(iso: string, lang: Lang) {
  const date = new Date(iso);
  return new Intl.DateTimeFormat(LOCALE_MAP[lang], {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function ProjectList({ projects, t, lang }: Props) {
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-10 text-center">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-brand-via/20 bg-brand-via/10 text-brand-via">
          <Sparkles className="h-5 w-5" />
        </span>
        <p className="text-sm font-medium text-zinc-200">
          {t.dashboard.emptyTitle}
        </p>
        <p className="max-w-xs text-xs text-zinc-500">
          {t.dashboard.emptyBody}
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {projects.map((project) => (
        <li key={project.id}>
          <Link
            href={`/projects/${project.id}`}
            className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/40 px-4 py-4 backdrop-blur transition hover:border-brand-via/40 hover:bg-zinc-900/70"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-via/60 to-transparent opacity-0 transition group-hover:opacity-100"
            />
            <span className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950/60 text-zinc-400 transition group-hover:border-brand-via/40 group-hover:text-brand-via">
              <FileCode2 className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-zinc-100">
                {project.name}
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                {formatDate(project.created_at, lang)}
              </p>
            </div>
            <span
              className={[
                "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide",
                STATUS_STYLES[project.status],
              ].join(" ")}
            >
              {t.dashboard.statusLabels[project.status]}
            </span>
            <ArrowUpRight className="h-4 w-4 flex-shrink-0 text-zinc-600 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-zinc-200" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
