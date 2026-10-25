"use client";

import { useMeQuery, useUpdateProfileMutation } from "@/hooks/use-me";
import { useChangePasswordMutation } from "@/hooks/use-auth-mutations";
import { friendlyAuthErrorMessage } from "@/lib/auth-errors";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DisplayNameForm } from "@/components/organisms/display-name-form/display-name-form";
import { ChangePasswordForm } from "@/components/organisms/change-password-form/change-password-form";
import { PageLoading } from "@/components/organisms/page-loading/page-loading";
import { ErrorState } from "@/components/molecules/error-state/error-state";

export default function SettingsPage() {
  const me = useMeQuery();
  const updateProfile = useUpdateProfileMutation();
  const changePassword = useChangePasswordMutation();

  if (me.isPending) {
    return <PageLoading message="Loading your settings..." />;
  }

  if (me.isError) {
    return (
      <main className="flex min-h-svh items-center">
        <ErrorState
          title="We couldn't load your settings"
          onRetry={() => void me.refetch()}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>How you appear to your partner.</CardDescription>
        </CardHeader>
        <CardContent>
          <DisplayNameForm
            defaultDisplayName={me.data.displayName}
            isSubmitting={updateProfile.isPending}
            isSaved={updateProfile.isSuccess}
            errorMessage={
              updateProfile.isError
                ? "We couldn't save your name. Please try again."
                : undefined
            }
            onSubmit={(input) => updateProfile.mutate(input)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            Changing your password signs you out on your other devices.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm
            isSubmitting={changePassword.isPending}
            isSaved={changePassword.isSuccess}
            errorMessage={
              changePassword.isError
                ? friendlyAuthErrorMessage(changePassword.error.message)
                : undefined
            }
            onSubmit={(input) => changePassword.mutate(input)}
          />
        </CardContent>
      </Card>
    </main>
  );
}
