"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { useMeQuery } from "@/hooks/use-me";
import { useSessionQuery } from "@/hooks/use-sessions";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { RedirectTo } from "@/components/organisms/redirect-to/redirect-to";
import { SessionPageSkeleton } from "@/components/molecules/session-page-skeleton/session-page-skeleton";
import { SessionPromptHeader } from "@/components/molecules/session-prompt-header/session-prompt-header";
import { apiErrorStatus } from "@/lib/api/api-error";

/** Statuses that mean "this isn't a conversation you can open". */
const NOT_FOUND_STATUSES = new Set([400, 403, 404]);

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const me = useMeQuery();
  const session = useSessionQuery(id);

  if (session.isPending || me.isPending) return <SessionPageSkeleton />;

  if (session.isError) {
    const notFound = NOT_FOUND_STATUSES.has(apiErrorStatus(session.error) ?? 0);
    return (
      <RedirectTo
        pageTitle={notFound ? "Conversation not found" : "Something went wrong"}
        pageMessage={
          notFound
            ? "This conversation doesn't exist or isn't part of your space."
            : "We couldn't load this conversation. Please try again in a moment."
        }
        redirectTo="/couple"
      />
    );
  }

  // The (app) layout already redirects when /me fails.
  if (!me.data) return null;

  const { data } = session;

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-8 p-6">
      <Link
        href="/couple"
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "-ml-2.5 self-start",
        )}
      >
        <ArrowLeftIcon aria-hidden="true" />
        Back to conversations
      </Link>

      <SessionPromptHeader prompt={data.prompt} />

      {data.phase === "answering" && <p>Answer form (P0-2)</p>}
      {data.phase === "waiting_for_partner" && <p>Waiting (P0-3)</p>}
      {data.phase === "ready_to_reveal" && <p>Reveal button (P0-5)</p>}
      {data.phase === "revealed" && <p>Both answers (P0-5)</p>}
    </main>
  );
}
