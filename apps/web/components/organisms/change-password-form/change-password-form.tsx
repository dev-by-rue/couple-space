"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  changePasswordSchema,
  type ChangePasswordInput,
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

// Web-only: the confirm field is a typing check, not a server rule.
const formSchema = changePasswordSchema.and(
  z
    .object({ newPassword: z.string(), confirmPassword: z.string() })
    .refine((v) => v.confirmPassword === v.newPassword, {
      message: "passwords don't match",
      path: ["confirmPassword"],
    }),
);

type FormValues = z.infer<typeof formSchema>;

type ChangePasswordFormProps = {
  /** The mutation's `isPending`. */
  isSubmitting: boolean;
  /** True after a successful change, until the form is edited again. */
  isSaved: boolean;
  errorMessage?: string;
  onSubmit: (input: ChangePasswordInput) => void;
};

export function ChangePasswordForm({
  isSubmitting,
  isSaved,
  errorMessage,
  onSubmit,
}: Readonly<ChangePasswordFormProps>) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });
  const { errors, isDirty } = form.formState;

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(({ currentPassword, newPassword }) => {
        onSubmit({ currentPassword, newPassword });
        form.reset();
      })}
    >
      <FieldGroup>
        <Field data-invalid={!!errors.currentPassword || undefined}>
          <FieldLabel htmlFor="currentPassword">Current password</FieldLabel>
          <Input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!errors.currentPassword || undefined}
            {...form.register("currentPassword")}
          />
          <FieldError>{errors.currentPassword?.message}</FieldError>
        </Field>

        <Field data-invalid={!!errors.newPassword || undefined}>
          <FieldLabel htmlFor="newPassword">New password</FieldLabel>
          <Input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.newPassword || undefined}
            {...form.register("newPassword")}
          />
          <FieldDescription>
            At least 12 characters, with upper and lower case letters and a
            digit.
          </FieldDescription>
          <FieldError>{errors.newPassword?.message}</FieldError>
        </Field>

        <Field data-invalid={!!errors.confirmPassword || undefined}>
          <FieldLabel htmlFor="confirmPassword">
            Confirm new password
          </FieldLabel>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.confirmPassword || undefined}
            {...form.register("confirmPassword")}
          />
          <FieldError>{errors.confirmPassword?.message}</FieldError>
        </Field>

        {errorMessage ? (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}
        {isSaved && !isDirty ? (
          <p role="status" className="text-sm text-muted-foreground">
            Password changed. Your other devices have been signed out.
          </p>
        ) : null}

        <Button type="submit" className="self-start" disabled={isSubmitting}>
          {isSubmitting ? "Changing…" : "Change password"}
        </Button>
      </FieldGroup>
    </form>
  );
}
