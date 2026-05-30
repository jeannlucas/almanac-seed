"use client";

import { useActionState, useRef, useState } from "react";
import { AlertCircle, FileUp, Loader2, Plus } from "lucide-react";

import { createProject, type CreateProjectState } from "@/app/dashboard/actions";
import type { Dictionary } from "@/lib/i18n/dictionary";

type Props = {
  t: Dictionary["dashboard"]["form"];
};

const FIELD_CLASS =
  "w-full rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 shadow-inner shadow-black/20 transition focus:border-brand-via/60 focus:outline-none focus:ring-2 focus:ring-brand-via/20";

export function NewProjectForm({ t }: Props) {
  const [state, action, pending] = useActionState<CreateProjectState, FormData>(
    createProject,
    undefined,
  );
  const [htmlValue, setHtmlValue] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setHtmlValue(text);
    setFileName(file.name);
  }

  return (
    <form
      action={action}
      className="space-y-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-6 backdrop-blur"
    >
      <div className="space-y-1.5">
        <label htmlFor="name" className="text-sm font-medium text-zinc-200">
          {t.nameLabel}
        </label>
        <input
          id="name"
          name="name"
          required
          maxLength={120}
          placeholder={t.namePlaceholder}
          className={FIELD_CLASS}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="html" className="text-sm font-medium text-zinc-200">
            {t.htmlLabel}
          </label>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-950/60 px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition hover:border-brand-via/40 hover:text-brand-via"
          >
            <FileUp className="h-3 w-3" />
            {fileName ? fileName : t.uploadIdle}
          </button>
        </div>
        <p className="text-xs text-zinc-500">{t.htmlHelper}</p>
        <textarea
          id="html"
          name="html"
          required
          rows={10}
          value={htmlValue}
          onChange={(event) => setHtmlValue(event.target.value)}
          placeholder="<!DOCTYPE html>..."
          className={`${FIELD_CLASS} font-mono text-xs leading-relaxed`}
        />
        <input
          ref={fileInput}
          type="file"
          accept=".html,text/html"
          onChange={handleFile}
          className="hidden"
        />
      </div>

      {state?.error ? (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{state.error}</span>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="group relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-zinc-950 shadow-[0_10px_40px_-12px_rgba(168,85,247,0.5)] ring-1 ring-white/10 transition hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.submitPending}
          </>
        ) : (
          <>
            <Plus className="h-4 w-4" />
            {t.submitIdle}
          </>
        )}
      </button>
    </form>
  );
}
