import { redirect } from "next/navigation";

import { Landing } from "@/components/landing/Landing";
import { getOptionalUser } from "@/lib/auth/require-user";
import { getLang } from "@/lib/i18n/server";

export default async function HomePage() {
  const { user } = await getOptionalUser();
  if (user) {
    redirect("/dashboard");
  }

  const lang = await getLang();
  return <Landing lang={lang} />;
}
