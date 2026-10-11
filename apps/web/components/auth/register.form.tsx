"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { registerSchema, type RegisterInput } from "@couple-space/domain";
import { cn } from "@/lib/utils";
import { withNextQuery } from "@/lib/auth-redirect";
import { friendlyAuthErrorMessage } from "@/lib/auth-errors";
import { useRegisterMutation } from "@/hooks/use-auth-mutations";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type RegisterFormProps = {
  onAuthenticated: () => void;
  /** Sanitized post-auth path — used for login link `next` query only. */
  next: string;
  className?: string;
};

export function RegisterForm({
  onAuthenticated,
  next,
  className,
}: Readonly<RegisterFormProps>) {
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      displayName: "",
      dateOfBirth: "",
    },
  });

  const registerMutation = useRegisterMutation({
    onSuccess: () => onAuthenticated(),
  });

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      onSubmit={form.handleSubmit((values) => registerMutation.mutate(values))}
      noValidate
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Create an account</h1>
          <p className="text-sm text-balance text-muted-foreground">
            Join Couple Space with your email and profile details.
          </p>
        </div>

        <Field data-invalid={!!form.formState.errors.displayName || undefined}>
          <FieldLabel htmlFor="displayName">Display name</FieldLabel>
          <Input
            id="displayName"
            autoComplete="nickname"
            aria-invalid={!!form.formState.errors.displayName || undefined}
            {...form.register("displayName")}
          />
          <FieldError>{form.formState.errors.displayName?.message}</FieldError>
        </Field>

        <Field data-invalid={!!form.formState.errors.email || undefined}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={!!form.formState.errors.email || undefined}
            {...form.register("email")}
          />
          <FieldError>{form.formState.errors.email?.message}</FieldError>
        </Field>

        <Field data-invalid={!!form.formState.errors.password || undefined}>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!form.formState.errors.password || undefined}
            {...form.register("password")}
          />
          <FieldError>{form.formState.errors.password?.message}</FieldError>
        </Field>

        <Field data-invalid={!!form.formState.errors.dateOfBirth || undefined}>
          <FieldLabel htmlFor="dateOfBirth">Date of birth</FieldLabel>
          <Input
            id="dateOfBirth"
            type="date"
            aria-invalid={!!form.formState.errors.dateOfBirth || undefined}
            {...form.register("dateOfBirth")}
          />
          <FieldError>{form.formState.errors.dateOfBirth?.message}</FieldError>
        </Field>

        {registerMutation.isError ? (
          <p className="text-sm text-destructive" role="alert">
            {friendlyAuthErrorMessage(registerMutation.error.message)}
          </p>
        ) : null}

        <Field>
          <Button
            type="submit"
            disabled={registerMutation.isPending}
            className="w-full"
          >
            {registerMutation.isPending ? "Creating…" : "Sign up"}
          </Button>
        </Field>

        <FieldDescription className="text-center">
          Already have an account?{" "}
          <Link
            href={withNextQuery("/login", next)}
            className="underline underline-offset-4"
          >
            Log in
          </Link>
        </FieldDescription>
      </FieldGroup>
    </form>
  );
}
