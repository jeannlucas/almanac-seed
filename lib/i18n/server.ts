import "server-only";

import { cookies, headers } from "next/headers";

import { LANG_COOKIE } from "./cookie";
import { isLang, SUPPORTED_LANGS, type Lang } from "./dictionary";

function pickFromAcceptLanguage(header: string | null): Lang {
  if (!header) return "pt";
  const tags = header.split(",").map((part) => part.split(";")[0]?.trim().toLowerCase() ?? "");
  for (const tag of tags) {
    const short = tag.slice(0, 2);
    if (SUPPORTED_LANGS.includes(short as Lang)) {
      return short as Lang;
    }
  }
  return "pt";
}

export async function getLang(): Promise<Lang> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LANG_COOKIE)?.value;
  if (isLang(fromCookie)) return fromCookie;
  const headerStore = await headers();
  return pickFromAcceptLanguage(headerStore.get("accept-language"));
}
