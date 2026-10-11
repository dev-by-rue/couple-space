"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { loginSchema, type LoginInput } from "@couple-space/domain";
import { cn } from "@/lib/utils";
import { withNextQuery } from "@/lib/auth-redirect";
import { friendlyAuthErrorMessage } from "@/lib/auth-errors";
import { useLoginMutation } from "@/hooks/use-auth-mutations";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type LoginFormProps = {
  onAuthenticated: () => void;
  /** Sanitized post-auth path — used for register link `next` query only. */
  next: string;
  className?: string;
};

export function LoginForm({
  onAuthenticated,
  next,
  className,
}: Readonly<LoginFormProps>) {
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "ruebencee@gmail.com", password: "Password1234" },
  });

  const login = useLoginMutation({
    onSuccess: () => onAuthenticated(),
  });

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      onSubmit={form.handleSubmit((values) => login.mutate(values))}
      noValidate
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Log in to Couple Space</h1>
          <p className="text-sm text-balance text-muted-foreground">
            Enter your email and password to continue.
          </p>
        </div>

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
            autoComplete="current-password"
            aria-invalid={!!form.formState.errors.password || undefined}
            {...form.register("password")}
          />
          <FieldError>{form.formState.errors.password?.message}</FieldError>
        </Field>

        {login.isError ? (
          <p className="text-sm text-destructive" role="alert">
            {friendlyAuthErrorMessage(login.error.message)}
          </p>
        ) : null}

        <Field>
          <Button type="submit" disabled={login.isPending} className="w-full">
            {login.isPending ? "Signing in…" : "Log in"}
          </Button>
        </Field>

        <FieldDescription className="text-center">
          Don&apos;t have an account?{" "}
          <Link
            href={withNextQuery("/register", next)}
            className="underline underline-offset-4"
          >
            Create an account
          </Link>
        </FieldDescription>
      </FieldGroup>
    </form>
  );
}
