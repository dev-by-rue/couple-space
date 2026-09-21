"use client";

import { useCreateCoupleMutation } from "@/hooks/use-couple";
import { Button } from "@/components/ui/button";

export function CreateCouplePanel() {
  const createCouple = useCreateCoupleMutation();

  return (
    <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Your couple space</h1>
      <p className="text-muted-foreground text-sm">
        You are not in a couple yet. Create one to invite your partner.
      </p>
      {createCouple.isError ? (
        <p className="text-sm text-red-600" role="alert">
          {createCouple.error.message}
        </p>
      ) : null}
      <Button
        onClick={() => createCouple.mutate()}
        disabled={createCouple.isPending}
      >
        {createCouple.isPending ? "Creating…" : "Create couple space"}
      </Button>
    </main>
  );
}
