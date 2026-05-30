"use client";

import { motion } from "framer-motion";
import {
  MessageSquarePlus,
  Share2,
  Upload,
  type LucideIcon,
} from "lucide-react";

import type { Dictionary, FeatureIcon } from "@/lib/i18n/dictionary";

type Props = {
  t: Dictionary["features"];
};

const ICONS: Record<FeatureIcon, LucideIcon> = {
  Upload,
  Share2,
  MessageSquarePlus,
};

export function Features({ t }: Props) {
  return (
    <section
      id="features"
      className="relative mx-auto max-w-6xl scroll-mt-20 px-6 pb-32"
    >
      <div className="mx-auto mb-12 max-w-2xl text-center">
        <h2 className="text-balance text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          {t.title}
        </h2>
        <p className="mt-3 text-pretty text-base text-zinc-400">
          {t.subtitle}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
        {t.items.map((feature, index) => {
          const Icon = ICONS[feature.icon];
          return (
            <motion.article
              key={feature.title}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 + index * 0.1, ease: "easeOut" }}
              className="group relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-6 backdrop-blur transition hover:border-brand-via/50 hover:bg-zinc-900/70"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-via/60 to-transparent opacity-0 transition group-hover:opacity-100"
              />
              <div className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-brand-via/20 bg-brand-via/10 text-brand-via">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-zinc-50">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-zinc-400">
                {feature.body}
              </p>
              <span
                aria-hidden
                className="absolute right-4 top-4 text-[11px] font-mono tabular-nums text-zinc-700"
              >
                0{index + 1}
              </span>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}
