"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";

type RegisterBody = {
  email: string;
  password: string;
  displayName: string;
  dateOfBirth: string;
};

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState<RegisterBody>({
    email: "",
    password: "",
    displayName: "",
    dateOfBirth: "",
  });
  const [error, setError] = useState<string | null>(null);

  const signup = useMutation({
    mutationFn: async (body: RegisterBody) => {
      await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify(body),
      });
      // TEMPORARY: stands in for "click link in verification email".
      // Replace with a real mailer + verify-token flow later.
      if (process.env.NODE_ENV === "development") {
        await apiFetch("/auth/dev/verify", { method: "POST" });
      }
    },
    onSuccess: () => {
      router.push("/couple");
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    signup.mutate(form);
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Create account</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Nest-owned auth — cookies only; no tokens in localStorage.
        </p>
      </div>

      <form className="flex flex-col gap-3" onSubmit={onSubmit}>
        <label className="flex flex-col gap-1 text-sm">
          Display name
          <input
            className="border-input rounded-md border px-3 py-2"
            required
            value={form.displayName}
            onChange={(e) =>
              setForm((f) => ({ ...f, displayName: e.target.value }))
            }
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            type="email"
            className="border-input rounded-md border px-3 py-2"
            required
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            type="password"
            className="border-input rounded-md border px-3 py-2"
            required
            minLength={12}
            value={form.password}
            onChange={(e) =>
              setForm((f) => ({ ...f, password: e.target.value }))
            }
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Date of birth
          <input
            type="date"
            className="border-input rounded-md border px-3 py-2"
            required
            value={form.dateOfBirth}
            onChange={(e) =>
              setForm((f) => ({ ...f, dateOfBirth: e.target.value }))
            }
          />
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Button type="submit" disabled={signup.isPending}>
          {signup.isPending ? "Creating…" : "Sign up"}
        </Button>
      </form>

      <p className="text-sm">
        Already have an account?{" "}
        <Link className="underline" href="/login">
          Log in
        </Link>
      </p>
    </main>
  );
}
