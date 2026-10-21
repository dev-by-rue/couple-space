"use client";

import { useThemesQuery } from "@/hooks/use-themes";
import { ThemeCard } from "@/components/molecules/theme-card/theme-card";
import { ErrorState } from "@/components/molecules/error-state/error-state";
import { PageLoading } from "@/components/organisms/page-loading/page-loading";

export default function StartPage() {
  const themes = useThemesQuery();

  if (themes.isPending) return <PageLoading message="Loading themes…" />;
  if (themes.isError)
    return (
      <main className="flex min-h-svh items-center">
        <ErrorState
          title="We couldn't load the themes"
          onRetry={() => void themes.refetch()}
        />
      </main>
    );

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-7xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">Choose a theme.</h1>
      <p className="text-sm text-muted-foreground">
        Pick a theme to get started with your conversation.
      </p>
      {themes.data.themes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No themes are available right now. Please check back soon.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {themes.data.themes.map((theme) => (
            <ThemeCard key={theme.id} theme={theme} />
          ))}
        </div>
      )}
    </main>
  );
}
