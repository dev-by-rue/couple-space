import Link from "next/link";
import {  buttonVariants } from "../ui/button";
import { cn } from "@/lib/utils";

export function StartConversation() {
  return (
    <section>
      <h2 className="text-2xl">
        A little time for the two of you
      </h2>
      <p className="mt-2 leading-relaxed text-muted-foreground">
        Choose a question, answer separately, and open your answers together.
      </p>
      <Link href="/start" className={cn(buttonVariants({ variant: "default", size: "lg" }), "w-full mt-4 rounded-md text-md")}>
        Start a conversation
      </Link>
    </section>
  );
}
