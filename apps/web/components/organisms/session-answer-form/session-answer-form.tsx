"use client";

import {
  DraftStatus,
  type DraftSaveStatus,
} from "@/components/atoms/draft-status/draft-status";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  FieldGroup,
  FieldLabel,
  Field,
  FieldDescription,
  FieldError,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import {
  ANSWER_MAX_LENGTH,
  SubmitAnswerInput,
  submitAnswerSchema,
} from "@couple-space/domain";
import { zodResolver } from "@hookform/resolvers/zod";
import { ListCheckIcon, LockKeyholeIcon } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";

type SessionAnswerFormProps = {
  partnerName: string;
  partnerSubmitted: boolean;
  errorMessage?: string;
  /** For saving a draft of the partners answers. */
  defaultText?: string;
  draftStatus: DraftSaveStatus;
  onTextChange?: (text: string) => void;
  handleSubmission: (text: string) => void;
};

const FORM_ID = "session-answer-form";

export function SessionAnswerForm({
  partnerName,
  partnerSubmitted,
  errorMessage,
  defaultText,
  draftStatus,
  onTextChange,
  handleSubmission,
}: Readonly<SessionAnswerFormProps>) {
  const form = useForm<SubmitAnswerInput>({
    resolver: zodResolver(submitAnswerSchema),
    mode: "onChange",
    defaultValues: {
      text: defaultText,
    },
  });

  const { errors, isValid, isSubmitting } = form.formState;
  const answerLength = useWatch({ control: form.control, name: "text" }).trim()
    .length;

  return (
    <form
      id={FORM_ID}
      className="flex flex-col gap-4"
      onSubmit={form.handleSubmit(({ text }) => handleSubmission(text))}
    >
      <p className="flex items-center gap-3 rounded-lg bg-secondary p-4 text-sm leading-relaxed text-secondary-foreground">
        <LockKeyholeIcon aria-hidden="true" className="size-4 shrink-0 mr-1" />
        Your partner will see once both of you have answered.
      </p>
      {partnerSubmitted ? (
        <p className="flex items-center gap-3 rounded-lg bg-primary p-4 text-sm leading-relaxed text-primary-foreground">
          <ListCheckIcon
            aria-hidden="true"
            className="size-5 shrink-0 mr-1 text-primary-foreground"
          />
          {partnerName} has answered. Your answer will stay private until you
          submit.
        </p>
      ) : null}

      <FieldGroup>
        <Field data-invalid={!!errors.text || undefined}>
          <FieldLabel htmlFor="answer-text" className="text-2xl">
            Your answer
          </FieldLabel>
          <Textarea
            id="answer-text"
            placeholder="Take your time... "
            readOnly={isSubmitting}
            aria-invalid={!!errors.text || undefined}
            className="min-h-56 rezise-none rounded-lg bg-card p-5 text-base leading-9 md:text-base"
            {...form.register("text", {
              onChange: (event) => onTextChange?.(event.target.value),
            })}
          />
          <FieldDescription className="flex justify-between gap-4">
            <DraftStatus status={draftStatus} />
            <span
              className={
                answerLength > ANSWER_MAX_LENGTH
                  ? "text-destructive"
                  : undefined
              }
            >
              {answerLength}/{ANSWER_MAX_LENGTH}
            </span>
          </FieldDescription>
          <FieldError>{errors.text?.message}</FieldError>
        </Field>
        {errorMessage ? (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}
        <Dialog>
          <DialogTrigger
            render={
              <Button
                type="button"
                size="lg"
                className="self-start px-6 text-sm"
                disabled={!isValid || isSubmitting}
              />
            }
          >
            {isSubmitting ? "Submitting…" : "Submit my answer"}
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-lg">Ready to submit?</DialogTitle>
              <DialogDescription className="text-sm leading-relaxed">
                Once submitted, you can&apos;t edit it. {partnerName} won&apos;t
                see it until you&apos;ve both answered and they choose to
                reveal.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Keep writing
              </DialogClose>
              <DialogClose render={<Button type="submit" form={FORM_ID} />}>
                Submit answer
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </FieldGroup>
    </form>
  );
}
