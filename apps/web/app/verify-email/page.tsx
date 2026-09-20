"use client";

import { Suspense, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { GalleryVerticalEnd } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { safeNextPath } from "@/lib/auth-redirect";
import { useVerifyEmailMutation } from "@/hooks/use-auth-mutations";
import { Button } from "@/components/ui/button";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const token = searchParams.get("token");
  const next = safeNextPath(searchParams.get("next"));
  const attempted = useRef(false);

  const verify = useVerifyEmailMutation({
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      router.replace(next);
    },
  });

  useEffect(() => {
    if (!token || attempted.current) {
      return;
    }
    attempted.current = true;
    verify.mutate({ token });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per token on mount
  }, [token]);

  if (!token) {
    return (
      <VerifyEmailShell>
        <div className="space-y-4 text-center">
          <h1 className="text-2xl font-bold">Invalid verification link</h1>
          <p className="text-sm text-muted-foreground">
            This link is missing or incomplete. Request a new verification
            email from your account.
          </p>
          <div className="flex flex-col gap-2">
            <Button
              className="w-full"
              onClick={() => router.push("/check-email")}
            >
              Go to check email
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push("/login")}
            >
              Log in
            </Button>
          </div>
        </div>
      </VerifyEmailShell>
    );
  }

  if (verify.isPending) {
    return (
      <VerifyEmailShell>
        <p className="text-center text-sm text-muted-foreground">
          Verifying your email…
        </p>
      </VerifyEmailShell>
    );
  }

  if (verify.isError) {
    return (
      <VerifyEmailShell>
        <div className="space-y-4 text-center">
          <h1 className="text-2xl font-bold">Link expired or invalid</h1>
          <p className="text-sm text-muted-foreground">
            This verification link may have expired or already been used. Sign
            in and request a new one.
          </p>
          <div className="flex flex-col gap-2">
            <Button
              className="w-full"
              onClick={() => router.push("/check-email")}
            >
              Request new link
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push("/login")}
            >
              Log in
            </Button>
          </div>
        </div>
      </VerifyEmailShell>
    );
  }

  return (
    <VerifyEmailShell>
      <p className="text-center text-sm text-muted-foreground">
        Email verified. Redirecting…
      </p>
    </VerifyEmailShell>
  );
}

function VerifyEmailShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <Link href="/" className="flex items-center gap-2 font-medium">
            <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <GalleryVerticalEnd className="size-4" />
            </div>
            Couple Space
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">{children}</div>
        </div>
      </div>
      <div className="relative hidden bg-muted lg:block" aria-hidden="true" />
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-svh items-center justify-center p-6 text-sm">
          Loading…
        </main>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
