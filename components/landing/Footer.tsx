import type { Dictionary } from "@/lib/i18n/dictionary";

type Props = {
  t: Dictionary;
};

const SOCIALS: Array<{ handle: string; href: string }> = [
  { handle: "@bigdev.z", href: "https://www.instagram.com/bigdev.z/" },
  { handle: "@jeannlucasdev", href: "https://www.instagram.com/jeannlucasdev/" },
];

function InstagramGlyph() {
  return (
    <svg
      aria-hidden
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function Footer({ t }: Props) {
  return (
    <footer className="border-t border-zinc-900/80 py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-6 text-center sm:flex-row sm:justify-center sm:gap-3">
        <p className="text-xs text-zinc-400">{t.footer.credit}</p>
        <span aria-hidden className="hidden text-zinc-700 sm:inline">
          ·
        </span>
        <div className="flex items-center gap-2">
          {SOCIALS.map((social) => (
            <a
              key={social.href}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900/60 px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition hover:border-brand-via/40 hover:text-brand-via"
            >
              <InstagramGlyph />
              {social.handle}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
