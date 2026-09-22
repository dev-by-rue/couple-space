import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageShell, PageSkeleton, PromptComposer, ThemeCard } from "@/components/couple-space";
import { useCouplePrototype } from "@/mocks/CouplePrototypeProvider";
import { CUSTOM_PROMPT_REQUIRES_PARTNER_ACCEPTANCE } from "@/config/productFlags";

// EXTRACTION [skip] TanStack route + head meta
// → ignore for apps/web (Next App Router)
export const Route = createFileRoute("/start")({
  head: () => ({
    meta: [
      { title: "Start a conversation — Between Us" },
      { name: "description", content: "Choose a thoughtful prompt for your next conversation." },
      { property: "og:title", content: "Start a conversation — Between Us" },
      {
        property: "og:description",
        content: "Choose a thoughtful prompt for your next conversation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  pendingComponent: () => <PageSkeleton detail />,
  component: StartPage,
});

// EXTRACTION [rewrite] Start page
// → app/(app)/start/page.tsx — theme/prompt selection; Nest-backed themes
function StartPage() {
  // EXTRACTION [skip] useCouplePrototype + productFlags bool
  // → ignore mocks; wire Nest theme/session APIs; rewrite flags as Nest/env config
  const { themes, startPrompt, startCustomPrompt } = useCouplePrototype();
  const navigate = useNavigate({ from: "/start" });
  const [selectedTheme, setSelectedTheme] = useState(themes[0]?.id ?? "");
  const theme = themes.find((item) => item.id === selectedTheme);
  const openSession = (id: string) => navigate({ to: "/conversation/$id", params: { id } });
  // OPEN QUESTION: Custom prompts currently start immediately; no acceptance screen is built.
  const startCustom = (text: string) => {
    if (!CUSTOM_PROMPT_REQUIRES_PARTNER_ACCEPTANCE) openSession(startCustomPrompt(text));
  };

  if (!themes.length)
    return (
      <PageShell>
        <h1 className="font-display text-3xl">No prompts are available right now.</h1>
        <p className="mt-3 text-muted-foreground">
          Please return to your space and try again shortly.
        </p>
      </PageShell>
    );

  return (
    <PageShell>
      {/* EXTRACTION [rewrite] Back nav
          → Next Link/button to /couple; pattern only */}
      <Button variant="ghost" className="-ml-3 h-11" onClick={() => navigate({ to: "/" })}>
        <ArrowLeft />
        Your space
      </Button>

      {/* EXTRACTION [rewrite] Start page header
          → page-level copy on start/page.tsx */}
      <header className="mt-7">
        <p className="text-xs font-semibold uppercase text-accent-foreground">A moment together</p>
        <h1 className="mt-2 font-display text-4xl">Start a conversation</h1>
        <p className="mt-3 max-w-xl leading-relaxed text-muted-foreground">
          Choose a theme or bring a question of your own. You will each answer privately.
        </p>
      </header>

      {/* EXTRACTION [rewrite] Curated / Custom tabs
          → Tabs atom (add-via-shadcn); do not copy prototype tabs.tsx */}
      <Tabs defaultValue="curated" className="mt-8">
        <TabsList className="grid h-12 w-full grid-cols-2">
          <TabsTrigger className="h-10" value="curated">
            Curated
          </TabsTrigger>
          <TabsTrigger className="h-10" value="custom">
            Custom
          </TabsTrigger>
        </TabsList>

        <TabsContent value="curated" className="mt-7">
          {/* EXTRACTION [rewrite] Theme picker grid + ThemeCard
              → molecules/theme-card.tsx */}
          <div className="grid grid-cols-2 gap-3">
            {themes.map((item) => (
              <ThemeCard
                key={item.id}
                theme={item}
                selected={item.id === selectedTheme}
                onSelect={() => setSelectedTheme(item.id)}
              />
            ))}
          </div>

          {theme && (
            <section className="mt-10">
              <h2 className="font-display text-2xl">{theme.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Pick the question that feels right today.
              </p>
              {/* EXTRACTION [rewrite] Inline prompt rows (<article>) — not a named component
                  → lift to molecules/prompt-list-item when rewriting */}
              <div className="mt-5 divide-y divide-border rounded-card border border-border bg-card px-5 shadow-soft">
                {theme.prompts.map((prompt) => (
                  <article key={prompt.id} className="py-5">
                    <h3 className="font-display text-xl leading-snug">{prompt.text}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{prompt.description}</p>
                    <Button
                      variant="outline"
                      className="mt-4 h-11 w-full sm:w-auto"
                      onClick={() => openSession(startPrompt(prompt.id))}
                    >
                      Start
                    </Button>
                  </article>
                ))}
              </div>
            </section>
          )}
        </TabsContent>

        <TabsContent value="custom" className="mt-7">
          {/* EXTRACTION [rewrite] PromptComposer — later ticket (T3), not walking skeleton
              → organisms/prompt-composer.tsx; Textarea via add-via-shadcn */}
          <PromptComposer onStart={startCustom} />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
