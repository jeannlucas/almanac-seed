import { redirect } from "next/navigation";

import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { getOptionalUser } from "@/lib/auth/require-user";

type Props = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const { user } = await getOptionalUser();
  const { next } = await searchParams;
  if (user) {
    redirect(next ?? "/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-8 px-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="text-sm text-neutral-600">
          Use your Google account to access your projects.
        </p>
      </div>
      <GoogleSignInButton redirectTo={next} />
    </main>
  );
}
