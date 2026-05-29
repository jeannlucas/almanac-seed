import Link from "next/link";
import { redirect } from "next/navigation";

import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { getOptionalUser } from "@/lib/auth/require-user";

export default async function HomePage() {
  const { user } = await getOptionalUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-10 px-6 text-center">
      <header className="space-y-4">
        <p className="text-sm uppercase tracking-widest text-neutral-500">
          Almanac
        </p>
        <h1 className="text-balance text-4xl font-semibold sm:text-5xl">
          Figma-style comments for any web page.
        </h1>
        <p className="text-pretty text-base text-neutral-600 sm:text-lg">
          Upload an HTML page, share a link, and let teammates drop pinned
          feedback right on the spot they care about.
        </p>
      </header>

      <GoogleSignInButton label="Sign in with Google" />

      <p className="text-xs text-neutral-500">
        Already have an account?{" "}
        <Link href="/login" className="underline">
          Go to login
        </Link>
      </p>
    </main>
  );
}
