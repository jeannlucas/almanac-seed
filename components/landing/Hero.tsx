"use client";

import { motion } from "framer-motion";
import { ArrowDown, Sparkles } from "lucide-react";

import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

import type { Dictionary } from "@/lib/i18n/dictionary";

type Props = {
  t: Dictionary["hero"];
};

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
};

export function Hero({ t }: Props) {
  return (
    <section className="relative mx-auto flex max-w-5xl flex-col items-center px-6 pb-24 pt-24 text-center sm:pt-32">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="flex flex-col items-center gap-8"
      >
        <motion.div
          variants={item}
          className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-zinc-300 backdrop-blur"
        >
          <Sparkles className="h-3.5 w-3.5 text-brand-via" />
          {t.kicker}
        </motion.div>

        <motion.h1
          variants={item}
          className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl md:text-7xl"
        >
          <span className="block text-zinc-50">{t.titleLine1}</span>
          <span className="block text-gradient-brand animate-gradient-pan">
            {t.titleLine2}
          </span>
        </motion.h1>

        <motion.p
          variants={item}
          className="max-w-2xl text-pretty text-base text-zinc-400 sm:text-lg"
        >
          {t.subtitle}
        </motion.p>

        <motion.div
          variants={item}
          className="flex flex-col items-center gap-3 sm:flex-row sm:gap-4"
        >
          <GoogleSignInButton variant="dark" label={t.ctaPrimary} />
          <a
            href="#features"
            className="group inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/40 px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-brand-via/60 hover:bg-zinc-900/80 hover:text-white"
          >
            {t.ctaSecondary}
            <ArrowDown className="h-4 w-4 transition group-hover:translate-y-0.5" />
          </a>
        </motion.div>
      </motion.div>
    </section>
  );
}
