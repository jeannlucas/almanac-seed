import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";

import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { AppBackground } from "@/components/app/AppBackground";
import { LanguageToggle } from "@/components/i18n/LanguageToggle";
import { getOptionalUser } from "@/lib/auth/require-user";
import { dictionary } from "@/lib/i18n/dictionary";
import { getLang } from "@/lib/i18n/server";

type Props = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const { user } = await getOptionalUser();
  const { next } = await searchParams;
  if (user) {
    redirect(next ?? "/dashboard");
  }

  const lang = await getLang();
  const t = dictionary[lang];

  return (
    <>
      <AppBackground />
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6">
        <div className="mb-8 flex w-full items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 transition hover:text-zinc-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t.login.back}
          </Link>
          <LanguageToggle lang={lang} />
        </div>

        <div className="w-full rounded-3xl border border-zinc-800/80 bg-zinc-900/50 p-8 shadow-2xl shadow-black/40 backdrop-blur">
          <div className="mb-6 flex flex-col items-center text-center">
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/60 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-300">
              <Sparkles className="h-3 w-3 text-brand-via" />
              Almanac
            </span>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
              {t.login.title}
            </h1>
            <p className="mt-2 text-sm text-zinc-400">{t.login.subtitle}</p>
          </div>

          <div className="flex justify-center">
            <GoogleSignInButton
              variant="dark"
              label={t.login.cta}
              redirectTo={next}
            />
          </div>
        </div>

        <p className="mt-6 text-xs text-zinc-500">{t.login.legal}</p>
      </main>
    </>
  );
}
