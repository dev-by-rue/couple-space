"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  createInvitationSchema,
  type CreateInvitationInput,
} from "@couple-space/domain";
import { useCreateInviteMutation } from "@/hooks/use-couple";
import { InviteLinkDisplay } from "@/components/molecules/invite-link-display";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type InvitePartnerFormProps = {
  coupleId: string;
};

export function InvitePartnerForm({
  coupleId,
}: Readonly<InvitePartnerFormProps>) {
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const form = useForm<CreateInvitationInput>({
    resolver: zodResolver(createInvitationSchema),
    defaultValues: { email: "" },
  });

  const createInvite = useCreateInviteMutation({
    onSuccess: (data) => {
      setInviteLink(`${window.location.origin}/invite/${data.token}`);
    },
  });

  return (
    <section className="space-y-3">
      <h2 className="font-medium">Invite partner</h2>
      <form
        className="flex flex-col gap-2"
        onSubmit={form.handleSubmit((values) =>
          createInvite.mutate({ coupleId, email: values.email }),
        )}
        noValidate
      >
        <FieldGroup>
          <Field data-invalid={!!form.formState.errors.email || undefined}>
            <FieldLabel htmlFor="invite-email">Partner email</FieldLabel>
            <Input
              id="invite-email"
              type="email"
              autoComplete="email"
              placeholder="partner@example.com"
              aria-invalid={!!form.formState.errors.email || undefined}
              {...form.register("email")}
            />
            <FieldError>{form.formState.errors.email?.message}</FieldError>
          </Field>

          {createInvite.isError ? (
            <p className="text-sm text-red-600" role="alert">
              {createInvite.error.message}
            </p>
          ) : null}

          <Field>
            <Button type="submit" disabled={createInvite.isPending}>
              {createInvite.isPending ? "Sending…" : "Create invite link"}
            </Button>
          </Field>
        </FieldGroup>
      </form>
      {inviteLink ? <InviteLinkDisplay href={inviteLink} /> : null}
    </section>
  );
}
