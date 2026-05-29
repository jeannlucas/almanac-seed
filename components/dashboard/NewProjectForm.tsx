"use client";

import { useActionState, useRef, useState } from "react";

import { createProject, type CreateProjectState } from "@/app/dashboard/actions";

export function NewProjectForm() {
  const [state, action, pending] = useActionState<CreateProjectState, FormData>(
    createProject,
    undefined,
  );
  const [htmlValue, setHtmlValue] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setHtmlValue(text);
  }

  return (
    <form action={action} className="space-y-4 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="space-y-1">
        <label htmlFor="name" className="text-sm font-medium">
          Project name
        </label>
        <input
          id="name"
          name="name"
          required
          maxLength={120}
          placeholder="Landing page v2"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-neutral-900 focus:outline-none"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="html" className="text-sm font-medium">
          Page HTML
        </label>
        <p className="text-xs text-neutral-500">
          Paste a full HTML document or upload an <code>.html</code> file.
        </p>
        <textarea
          id="html"
          name="html"
          required
          rows={10}
          value={htmlValue}
          onChange={(event) => setHtmlValue(event.target.value)}
          placeholder="<!DOCTYPE html>..."
          className="w-full rounded-md border border-neutral-300 px-3 py-2 font-mono text-xs shadow-sm focus:border-neutral-900 focus:outline-none"
        />
        <input
          ref={fileInput}
          type="file"
          accept=".html,text/html"
          onChange={handleFile}
          className="block text-xs text-neutral-500"
        />
      </div>

      {state?.error ? (
        <p className="text-sm text-red-600">{state.error}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-neutral-700 disabled:opacity-60"
      >
        {pending ? "Creating..." : "Create project"}
      </button>
    </form>
  );
}
