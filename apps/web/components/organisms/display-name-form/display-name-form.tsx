"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  updateProfileSchema,
  type UpdateProfileInput,
} from "@couple-space/domain";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type DisplayNameFormProps = {
  defaultDisplayName: string;
  /** The mutation's `isPending`. */
  isSubmitting: boolean;
  /** True after a successful save, until the field is edited again. */
  isSaved: boolean;
  errorMessage?: string;
  onSubmit: (input: UpdateProfileInput) => void;
};

export function DisplayNameForm({
  defaultDisplayName,
  isSubmitting,
  isSaved,
  errorMessage,
  onSubmit,
}: Readonly<DisplayNameFormProps>) {
  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { displayName: defaultDisplayName },
  });
  const { errors, isDirty } = form.formState;

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) => {
        onSubmit(values);
        // Makes the saved value the new baseline so the button disables again.
        form.reset(values);
      })}
    >
      <FieldGroup>
        <Field data-invalid={!!errors.displayName || undefined}>
          <FieldLabel htmlFor="displayName">Display name</FieldLabel>
          <Input
            id="displayName"
            autoComplete="nickname"
            maxLength={40}
            aria-invalid={!!errors.displayName || undefined}
            {...form.register("displayName")}
          />
          <FieldDescription>Only your partner sees this.</FieldDescription>
          <FieldError>{errors.displayName?.message}</FieldError>
        </Field>

        {errorMessage ? (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}
        {isSaved && !isDirty ? (
          <p role="status" className="text-sm text-muted-foreground">
            Saved.
          </p>
        ) : null}

        <Button
          type="submit"
          className="self-start"
          disabled={!isDirty || isSubmitting}
        >
          {isSubmitting ? "Saving…" : "Save name"}
        </Button>
      </FieldGroup>
    </form>
  );
}
