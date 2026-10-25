"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useThemesQuery } from "@/hooks/use-themes";
import { useCreateSessionMutation } from "@/hooks/use-sessions";
import {
  filterPrompts,
  PROMPT_PAGE_SIZE,
  promptFiltersHref,
  readPromptFilters,
} from "@/lib/prompt-filters";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { PromptCard } from "@/components/molecules/prompt-card/prompt-card";
import { PromptFilters } from "@/components/molecules/prompt-filters/prompt-filters";
import { ErrorState } from "@/components/molecules/error-state/error-state";
import { PageLoading } from "@/components/organisms/page-loading/page-loading";
import { RedirectTo } from "@/components/organisms/redirect-to/redirect-to";

function ThemePromptsContent() {
  const router = useRouter();
  const { slug } = useParams<{ slug: string }>();
  const searchParams = useSearchParams();

  const createSession = useCreateSessionMutation({
    onSuccess: ({ id }) => router.push(`/conversation/${id}`),
  });

  const themes = useThemesQuery();

  if (themes.isPending) return <PageLoading message="Loading prompts…" />;
  if (themes.isError)
    return (
      <main className="flex min-h-svh items-center">
        <ErrorState
          title="We couldn't load this theme"
          onRetry={() => void themes.refetch()}
        />
      </main>
    );

  const theme = themes.data.themes.find((theme) => theme.slug === slug);

  if (!theme)
    return (
      <RedirectTo
        pageTitle="Theme not found"
        pageMessage="The theme you are looking for does not exist."
        redirectTo="/start"
      />
    );

  const pathname = `/start/${theme.slug}`;
  const filters = readPromptFilters(
    searchParams,
    themes.data.tags.map((tag) => tag.slug),
  );
  const matching = filterPrompts(theme.prompts, filters);
  const shown = matching.slice(0, filters.show);
  const remaining = matching.length - shown.length;

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">{theme.title}</h1>
        <p className="text-sm text-muted-foreground">{theme.description}</p>
      </div>

      <PromptFilters
        pathname={pathname}
        filters={filters}
        tags={themes.data.tags}
      />

      {matching.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg bg-muted p-8 text-center">
          <p>No questions match these filters.</p>
          <Link
            href={pathname}
            scroll={false}
            className="text-sm underline underline-offset-4"
          >
            Clear filters
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {shown.map((prompt) => (
              <PromptCard
                key={prompt.id}
                prompt={prompt}
                disabled={createSession.isPending}
                onSelect={(promptId) => createSession.mutate({ promptId })}
              />
            ))}
          </div>

          {createSession.isError ? (
            <p role="alert" className="text-sm text-destructive">
              Couldn&apos;t start that conversation. Please try again.
            </p>
          ) : null}

          <div className="flex flex-col items-center gap-3 pb-6">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Showing {shown.length} of {matching.length}
            </p>
            {remaining > 0 ? (
              <Link
                href={promptFiltersHref(pathname, {
                  ...filters,
                  show: filters.show + PROMPT_PAGE_SIZE,
                })}
                // Keep the reader's place: new cards appear below.
                scroll={false}
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "w-full max-w-sm",
                )}
              >
                Show {Math.min(PROMPT_PAGE_SIZE, remaining)} more
              </Link>
            ) : null}
          </div>
        </>
      )}
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoading message="Loading prompts…" />}>
      <ThemePromptsContent />
    </Suspense>
  );
}
