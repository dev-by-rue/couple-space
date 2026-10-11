"use client";

import { useThemesQuery } from "@/hooks/use-themes";
import { ThemeCard } from "@/components/molecules/theme-card/theme-card";

export default function StartPage() {
  const themes = useThemesQuery();

  if (themes.isLoading)
    return (
      <div>
        <p>Loading themes...</p>
      </div>
    );
  if (themes.isError)
    return (
      <div>
        <p>Error loading themes</p>
      </div>
    );

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-7xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">Choose a theme.</h1>
      <p className="text-sm text-muted-foreground">
        Pick a theme to get started with your conversation.
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {themes.data?.themes.map((theme) => (
          <ThemeCard key={theme.id} theme={theme} />
        ))}
      </div>
    </main>
  );
}
