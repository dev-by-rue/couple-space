"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoginForm } from "@/components/auth/login.form";
import { safeNextPath } from "@/lib/auth-redirect";
import Link from "next/link";
import { Logo } from "@/components/atoms/logo/logo";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <LoginForm next={next} onAuthenticated={() => router.push(next)} />
          </div>
        </div>
      </div>
      <div
        className="relative hidden items-center justify-center bg-secondary/20 lg:flex"
        aria-hidden="true"
      >
        <Logo className="size-48" />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-svh items-center justify-center p-6 text-sm">
          Loading…
        </main>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
