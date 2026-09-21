"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { GalleryVerticalEnd } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { safeNextPath } from "@/lib/auth-redirect";
import { friendlyAuthErrorMessage } from "@/lib/auth-errors";
import { useResendVerificationMutation } from "@/hooks/use-auth-mutations";
import { ME_QUERY_KEY, useMeQuery } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";

function CheckEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const next = safeNextPath(searchParams.get("next"));

  const me = useMeQuery();

  const resend = useResendVerificationMutation({
    onSuccess: async (data) => {
      if (data.alreadyVerified) {
        await queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
        router.replace(next);
      }
    },
  });

  useEffect(() => {
    if (me.isError) {
      router.replace("/login");
      return;
    }
    if (me.data?.emailVerified) {
      void (async () => {
        await queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
        router.replace(next);
      })();
    }
  }, [me.isError, me.data?.emailVerified, next, queryClient, router]);

  if (me.isPending || me.isError || me.data?.emailVerified) {
    return (
      <main className="flex min-h-svh items-center justify-center p-6 text-sm">
        Loading…
      </main>
    );
  }

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
          <div className="w-full max-w-xs space-y-6">
            <div className="flex flex-col items-center gap-1 text-center">
              <h1 className="text-2xl font-bold">Check your email</h1>
              <p className="text-sm text-balance text-muted-foreground">
                We sent a verification link to{" "}
                <span className="font-medium text-foreground">
                  {me.data.email}
                </span>
                . Click the link to continue.
              </p>
            </div>

            {resend.isSuccess && !resend.data?.alreadyVerified ? (
              <p className="text-center text-sm text-muted-foreground">
                {resend.data?.sent === false
                  ? "We could not send the email right now. Please try again shortly."
                  : "Verification email sent. Check your inbox."}
              </p>
            ) : null}

            {resend.isError ? (
              <p className="text-center text-sm text-destructive" role="alert">
                {friendlyAuthErrorMessage(resend.error.message)}
              </p>
            ) : null}

            <Button
              className="w-full"
              onClick={() => resend.mutate()}
              disabled={resend.isPending}
            >
              {resend.isPending ? "Sending…" : "Resend verification email"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Wrong account?{" "}
              <Link href="/login" className="underline underline-offset-4">
                Log in
              </Link>
            </p>
          </div>
        </div>
      </div>
      <div className="relative hidden bg-muted lg:block" aria-hidden="true" />
    </div>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-svh items-center justify-center p-6 text-sm">
          Loading…
        </main>
      }
    >
      <CheckEmailContent />
    </Suspense>
  );
}
