"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GalleryVerticalEnd } from "lucide-react";
import { RegisterForm } from "@/components/auth/register.form";
import { safeNextPath, withNextQuery } from "@/lib/auth-redirect";

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="/" className="flex items-center gap-2 font-medium">
            <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <GalleryVerticalEnd className="size-4" />
            </div>
            Couple Space
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <RegisterForm
              next={next}
              onAuthenticated={() =>
                router.push(withNextQuery("/check-email", next))
              }
            />
          </div>
        </div>
      </div>
      <div className="relative hidden bg-muted lg:block" aria-hidden="true" />
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-svh items-center justify-center p-6 text-sm">
          Loading…
        </main>
      }
    >
      <RegisterPageContent />
    </Suspense>
  );
}
