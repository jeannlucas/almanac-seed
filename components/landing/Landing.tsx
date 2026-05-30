import { dictionary, type Lang } from "@/lib/i18n/dictionary";

import { BackgroundFX } from "./BackgroundFX";
import { Features } from "./Features";
import { Footer } from "./Footer";
import { Hero } from "./Hero";
import { TopBar } from "./TopBar";

type Props = {
  lang: Lang;
};

export function Landing({ lang }: Props) {
  const t = dictionary[lang];

  return (
    <>
      <BackgroundFX />
      <div className="flex min-h-screen flex-col">
        <TopBar t={t} lang={lang} />
        <main className="flex-1">
          <Hero t={t.hero} />
          <Features t={t.features} />
        </main>
        <Footer t={t} />
      </div>
    </>
  );
}
