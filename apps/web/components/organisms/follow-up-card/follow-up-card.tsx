"use client";

import { useId } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  submitAnswerSchema,
  type SessionViewerPhase,
  type SubmitAnswerInput,
} from "@couple-space/domain";
import type { SessionResponse } from "@/hooks/use-sessions";
import { AnswerCard } from "@/components/molecules/answer-card/answer-card";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

type FollowUpCardProps = {
  /** The follow-up question. */
  question: string;
  /** Null until either partner starts it. */
  phase: SessionViewerPhase | null;
  /** Both members' responses, already redacted by the API. */
  responses: SessionResponse[];
  /** The viewer's user id. */
  viewerId: string;
  /** The partner's display name. */
  partnerName: string;
  /** True while the follow-up is being started or the answer sent. */
  isSubmitting: boolean;
  errorMessage?: string;
  /** Called with the validated, trimmed answer. */
  onSubmit: (text: string) => void;
};

/**
 * One optional follow-up under the revealed answers.
 *
 * @remarks
 * There's no Reveal step: once both have submitted, the API returns both
 * texts and the card shows them.
 */
export function FollowUpCard({
  question,
  phase,
  responses,
  viewerId,
  partnerName,
  isSubmitting,
  errorMessage,
  onSubmit,
}: Readonly<FollowUpCardProps>) {
  const form = useForm<SubmitAnswerInput>({
    resolver: zodResolver(submitAnswerSchema),
    defaultValues: { text: "" },
  });
  const { errors } = form.formState;
  const fieldId = useId();

  const answerForm = (
    <form
      className="flex flex-col gap-3"
      noValidate
      onSubmit={form.handleSubmit(({ text }) => onSubmit(text))}
    >
      <Field data-invalid={!!errors.text || undefined}>
        <FieldLabel htmlFor={fieldId} className="sr-only">
          Your answer to: {question}
        </FieldLabel>
        <Textarea
          id={fieldId}
          placeholder="Your private answer"
          readOnly={isSubmitting}
          aria-invalid={!!errors.text || undefined}
          className="min-h-28 resize-none rounded-lg bg-background p-4 text-sm md:text-sm"
          {...form.register("text")}
        />
        <FieldError>{errors.text?.message}</FieldError>
      </Field>
      {errorMessage ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}
      <Button type="submit" className="self-start" disabled={isSubmitting}>
        {isSubmitting ? "Sending…" : "Submit answer"}
      </Button>
    </form>
  );

  return (
    <article className="flex flex-col gap-4 rounded-lg bg-card p-5 text-card-foreground ring-1 ring-foreground/10">
      <p className="text-xs font-semibold tracking-wide text-accent-foreground uppercase">
        Follow-up
      </p>
      <h3 className="text-xl leading-snug">{question}</h3>

      {phase === "revealed" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {responses.map((r) =>
            r.text === null ? null : (
              <AnswerCard
                key={r.userId}
                authorName={r.displayName}
                text={r.text}
                isOwn={r.userId === viewerId}
              />
            ),
          )}
        </div>
      ) : phase === "waiting_for_partner" ? (
        <p
          aria-live="polite"
          className="rounded-lg bg-waiting-soft p-4 text-sm leading-relaxed text-waiting-foreground"
        >
          Your answer is saved. Both answers appear as soon as {partnerName} has
          answered too.
        </p>
      ) : phase === "answering" ? (
        // Partner already started it: no need to hide the form.
        answerForm
      ) : (
        <Collapsible>
          <CollapsibleTrigger
            render={<Button variant="outline" className="self-start" />}
          >
            Answer this
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">{answerForm}</CollapsibleContent>
        </Collapsible>
      )}
    </article>
  );
}
