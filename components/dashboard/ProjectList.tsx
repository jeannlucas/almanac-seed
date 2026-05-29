import Link from "next/link";

import type { Project } from "@/lib/types/db";

type Props = {
  projects: Pick<Project, "id" | "name" | "status" | "created_at">[];
};

export function ProjectList({ projects }: Props) {
  if (projects.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-neutral-300 bg-white p-6 text-sm text-neutral-600">
        No projects yet. Create your first one on the right.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {projects.map((project) => (
        <li key={project.id}>
          <Link
            href={`/projects/${project.id}`}
            className="flex items-center justify-between rounded-md border border-neutral-200 bg-white px-4 py-3 shadow-sm hover:border-neutral-400"
          >
            <div>
              <p className="text-sm font-medium">{project.name}</p>
              <p className="text-xs text-neutral-500">
                Created {new Date(project.created_at).toLocaleString()}
              </p>
            </div>
            <span className="rounded-full bg-neutral-100 px-2 py-1 text-xs uppercase tracking-wide text-neutral-600">
              {project.status}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
