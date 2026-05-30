import Link from "next/link";
import { LogOut } from "lucide-react";

import { LanguageToggle } from "@/components/i18n/LanguageToggle";
import type { Dictionary, Lang } from "@/lib/i18n/dictionary";

type Props = {
  t: Dictionary;
  lang: Lang;
  email: string;
  fullName?: string | null;
  avatarUrl?: string | null;
};

function initialOf(value: string) {
  return value.trim().charAt(0).toUpperCase() || "?";
}

export function AppHeader({ t, lang, email, fullName, avatarUrl }: Props) {
  const displayName = fullName?.trim() || email;
  const initial = initialOf(displayName);

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-800/60 bg-zinc-950/70 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link
          href="/dashboard"
          className="group inline-flex items-center gap-2 text-sm font-semibold tracking-tight"
        >
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full bg-brand-gradient shadow-[0_0_12px_rgba(168,85,247,0.8)] transition group-hover:scale-125"
          />
          <span className="text-zinc-100">Almanac</span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageToggle lang={lang} />

          <div className="hidden items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 py-1 pl-1 pr-3 text-xs text-zinc-300 backdrop-blur sm:inline-flex">
            <UserAvatar avatarUrl={avatarUrl} initial={initial} />
            <span className="truncate max-w-[12rem]">{displayName}</span>
          </div>
          {/* Avatar-only badge for narrow screens */}
          <div className="inline-flex items-center rounded-full border border-zinc-800 bg-zinc-900/60 p-1 sm:hidden">
            <UserAvatar avatarUrl={avatarUrl} initial={initial} />
          </div>

          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t.nav.signOut}</span>
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

function UserAvatar({
  avatarUrl,
  initial,
}: {
  avatarUrl?: string | null;
  initial: string;
}) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        referrerPolicy="no-referrer"
        className="h-6 w-6 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-gradient text-[11px] font-semibold text-zinc-950">
      {initial}
    </span>
  );
}
