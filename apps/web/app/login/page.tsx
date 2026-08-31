"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";

type LoginBody = {
  email: string;
  password: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState<LoginBody>({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);

  const login = useMutation({
    mutationFn: (body: LoginBody) =>
      apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify(body),
      }),
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
    login.mutate(form);
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Log in</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Session is stored in httpOnly cookies via the API.
        </p>
      </div>

      <form className="flex flex-col gap-3" onSubmit={onSubmit}>
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
            value={form.password}
            onChange={(e) =>
              setForm((f) => ({ ...f, password: e.target.value }))
            }
          />
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Button type="submit" disabled={login.isPending}>
          {login.isPending ? "Signing in…" : "Log in"}
        </Button>
      </form>

      <p className="text-sm">
        New here?{" "}
        <Link className="underline" href="/signup">
          Create an account
        </Link>
      </p>
    </main>
  );
}
