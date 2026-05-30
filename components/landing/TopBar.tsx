import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { LanguageToggle } from "@/components/i18n/LanguageToggle";
import type { Dictionary, Lang } from "@/lib/i18n/dictionary";

type Props = {
  t: Dictionary;
  lang: Lang;
};

export function TopBar({ t, lang }: Props) {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-800/60 bg-zinc-950/70 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="group inline-flex items-center gap-2 text-sm font-semibold tracking-tight"
        >
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full bg-brand-gradient shadow-[0_0_12px_rgba(168,85,247,0.8)] transition group-hover:scale-125"
          />
          <span className="text-zinc-100">Almanac</span>
        </Link>

        <div className="flex items-center gap-3">
          <LanguageToggle lang={lang} />
          <Link
            href="/login"
            className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-700 hover:text-white"
          >
            {t.nav.signIn}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
