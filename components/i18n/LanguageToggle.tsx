"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { LANG_COOKIE, LANG_COOKIE_MAX_AGE } from "@/lib/i18n/cookie";
import { LANG_META, SUPPORTED_LANGS, type Lang } from "@/lib/i18n/dictionary";

type Props = {
  lang: Lang;
  compact?: boolean;
};

export function LanguageToggle({ lang, compact = false }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleChange(next: Lang) {
    if (next === lang) return;
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=${LANG_COOKIE_MAX_AGE}; SameSite=Lax`;
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div
      role="group"
      aria-label="Language"
      data-pending={pending ? "" : undefined}
      className="inline-flex items-center rounded-full border border-zinc-800 bg-zinc-900/60 p-1 text-xs backdrop-blur"
    >
      {SUPPORTED_LANGS.map((value) => {
        const active = value === lang;
        const meta = LANG_META[value];
        return (
          <button
            key={value}
            type="button"
            onClick={() => handleChange(value)}
            disabled={pending}
            aria-pressed={active}
            className={[
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 transition disabled:opacity-60",
              active
                ? "bg-zinc-100 text-zinc-900 shadow-sm"
                : "text-zinc-400 hover:text-zinc-100",
            ].join(" ")}
          >
            <span aria-hidden className="text-sm leading-none">
              {meta.flag}
            </span>
            {!compact ? (
              <span className="font-medium tracking-wide">{meta.label}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
