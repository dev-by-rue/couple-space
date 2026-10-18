"use client";

import { useThemesQuery } from "@/hooks/use-themes";
import { PromptCard } from "@/components/molecules/prompt-card/prompt-card";
import { useParams, useRouter } from "next/navigation";
import { PageLoading } from "@/components/organisms/page-loading/page-loading";
import { RedirectTo } from "@/components/organisms/redirect-to/redirect-to";
import { useCreateSessionMutation } from "@/hooks/use-sessions";

export default function Page() {
  const router = useRouter();
  const { slug } = useParams<{ slug: string }>();

  const createSession = useCreateSessionMutation({
    onSuccess: ({ id }) => router.push(`/conversation/${id}`),
  });

  const themes = useThemesQuery();

  if (themes.isLoading) return <PageLoading message="Loading themes..." />;
  if (themes.isError)
    return (
      <div>
        <p>Error loading themes</p>
      </div>
    );

  const theme = themes.data?.themes.find((theme) => theme.slug === slug);

  if (!theme)
    return (
      <RedirectTo
        pageTitle="Theme not found"
        pageMessage="The theme you are looking for does not exist."
        redirectTo="/start"
      />
    );

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-7xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">{theme.title}</h1>
      <p className="text-sm text-muted-foreground">{theme.description}</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {theme.prompts.map((prompt) => (
          <PromptCard
            key={prompt.id}
            prompt={prompt}
            disabled={createSession.isPending}
            onSelect={(promptId) => createSession.mutate({ promptId })}
          />
        ))}
        {createSession.isError ? (
          <p role="alert" className="text-sm text-destructive">
            Couldn&apos;t start that conversation. Please try again.
          </p>
        ) : null}
      </div>
    </main>
  );
}
