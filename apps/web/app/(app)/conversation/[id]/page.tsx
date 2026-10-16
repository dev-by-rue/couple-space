"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { useMeQuery } from "@/hooks/use-me";
import {
  sessionQueryKey,
  useSessionQuery,
  useSubmitResponseMutation,
} from "@/hooks/use-sessions";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { RedirectTo } from "@/components/organisms/redirect-to/redirect-to";
import { SessionPageSkeleton } from "@/components/molecules/session-page-skeleton/session-page-skeleton";
import { SessionPromptHeader } from "@/components/molecules/session-prompt-header/session-prompt-header";
import { apiErrorReason, apiErrorStatus } from "@/lib/api/api-error";
import { SessionAnswerForm } from "@/components/organisms/session-answer-form/session-answer-form";
import { useQueryClient } from "@tanstack/react-query";
import { SessionWaiting } from "@/components/molecules/session-waiting/session-waiting";

/** Statuses that mean "this isn't a conversation you can open". */
const NOT_FOUND_STATUSES = new Set([400, 403, 404]);

function submissionErrorMessage(error: Error): string {
  if (apiErrorReason(error) === "already_submitted") {
    return "You've already answered this one. Refreshing...";
  }
  return "Your answer didn't send. Your text is still here - try again";
}

export default function ConversationPage() {
  const client = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const me = useMeQuery();
  const session = useSessionQuery(id);

  const submit = useSubmitResponseMutation({
    onError: (error) => {
      if (apiErrorReason(error) === "already_submitted") {
        void client.invalidateQueries({ queryKey: sessionQueryKey(id) });
      }
    },
  });
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

  const partner = data.responses.find(
    (response) => response.userId !== me.data.id,
  );
  const own = data.responses.find((r) => r.userId === me.data.id);
  const partnerName = partner?.displayName ?? "Your partner";

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

      {data.phase === "answering" && (
        <SessionAnswerForm
          partnerName={partnerName}
          partnerSubmitted={data.partnerSubmitted}
          errorMessage={
            submit.isError ? submissionErrorMessage(submit.error) : undefined
          }
          handleSubmission={(text) =>
            submit.mutate({
              sessionId: id,
              text,
            })
          }
        />
      )}
      {data.phase === "waiting_for_partner" && (
        <SessionWaiting
          partnerName={partnerName}
          viewerName={me.data.displayName}
          ownAnswer={own?.text ?? null}
        />
      )}
      {data.phase === "ready_to_reveal" && <p>Reveal button (P0-5)</p>}
      {data.phase === "revealed" && <p>Both answers (P0-5)</p>}
    </main>
  );
}
