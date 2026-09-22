"use client";

import { useRelationshipQuote } from "@/hooks/use-relationship-quote";
import { Heart } from "lucide-react";

const FALLBACK_TITLE = "This space belongs to both of you.";
const FALLBACK_BODY =
  "There are no right ways to answer. Take your time, be honest, and meet each other with curiosity.";

export function WelcomeBanner() {
  const { data } = useRelationshipQuote();

  return (
    <section className="relative mb-8 overflow-hidden rounded-xl bg-accent-soft p-6 mt-10 shadow">
      <Heart className="size-5 text-accent-foreground" />
      <h2 className="mt-4 font-sans text-2xl text-foreground">
        {data?.quote ?? FALLBACK_TITLE}
      </h2>
      {data?.author ? (
        <p className="mt-2 max-w-lg leading-relaxed text-muted-foreground">
          — {data.author}
        </p>
      ) : !data ? (
        <p className="mt-2 max-w-lg leading-relaxed text-muted-foreground">
          {FALLBACK_BODY}
        </p>
      ) : null}
    </section>
  );
}
