"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";

type CoupleMe = {
  coupleId: string;
  status: string;
  members: Array<{
    userId: string;
    email: string;
    displayName: string;
    emailVerified: boolean;
  }>;
};

export default function CouplePage() {
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const couple = useQuery({
    queryKey: ["couples", "me"],
    queryFn: async () => {
      try {
        return await apiFetch<CoupleMe>("/couples/me");
      } catch (err) {
        // 404 no_couple is an expected empty state
        if (err instanceof Error && err.message.includes("404")) {
          return null;
        }
        throw err;
      }
    },
  });

  const createCouple = useMutation({
    mutationFn: () => apiFetch<{ coupleId: string; status: string }>("/couples", {
      method: "POST",
    }),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["couples", "me"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const createInvite = useMutation({
    mutationFn: (email: string) => {
      if (!couple.data) {
        throw new Error("No couple");
      }
      return apiFetch<{ token: string; expiresAt: string }>(
        `/couples/${couple.data.coupleId}/invitations`,
        {
          method: "POST",
          body: JSON.stringify({ email }),
        },
      );
    },
    onSuccess: (data) => {
      setError(null);
      setInviteLink(`${window.location.origin}/invite/${data.token}`);
    },
    onError: (err: Error) => setError(err.message),
  });

  function onInvite(event: FormEvent) {
    event.preventDefault();
    createInvite.mutate(inviteEmail);
  }

  if (couple.isPending) {
    return <main className="p-6 text-sm">Loading couple…</main>;
  }

  if (couple.isError) {
    return (
      <main className="p-6 text-sm text-red-600">{couple.error.message}</main>
    );
  }

  if (!couple.data) {
    return (
      <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-center gap-4 p-6">
        <h1 className="text-2xl font-semibold">Your couple space</h1>
        <p className="text-muted-foreground text-sm">
          You are not in a couple yet. Create one to invite your partner.
        </p>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button
          onClick={() => createCouple.mutate()}
          disabled={createCouple.isPending}
        >
          {createCouple.isPending ? "Creating…" : "Create couple space"}
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-lg flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Your couple space</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Status: <strong>{couple.data.status}</strong>
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="font-medium">Members</h2>
        <ul className="text-sm">
          {couple.data.members.map((m) => (
            <li key={m.userId}>
              {m.displayName} ({m.email})
              {m.emailVerified ? "" : " — unverified"}
            </li>
          ))}
        </ul>
      </section>

      {couple.data.status === "active" ? (
        <p className="text-sm">Couple active. Private space is ready.</p>
      ) : (
        <section className="space-y-3">
          <h2 className="font-medium">Invite partner</h2>
          <form className="flex flex-col gap-2" onSubmit={onInvite}>
            <input
              type="email"
              required
              placeholder="partner@example.com"
              className="border-input rounded-md border px-3 py-2 text-sm"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
            <Button type="submit" disabled={createInvite.isPending}>
              {createInvite.isPending ? "Sending…" : "Create invite link"}
            </Button>
          </form>
          {inviteLink ? (
            <p className="break-all rounded-md bg-muted p-3 text-xs">
              Share this link: {inviteLink}
            </p>
          ) : null}
        </section>
      )}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </main>
  );
}
