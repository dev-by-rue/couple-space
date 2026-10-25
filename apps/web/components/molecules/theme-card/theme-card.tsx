import Link from "next/link";
import type { ThemeDto } from "@/hooks/use-themes";
import { ThemeIcon } from "@/components/molecules/theme-icon/theme-icon";

type ThemeCardProps = {
  /** The theme, as returned by `GET /themes`. */
  theme: ThemeDto;
};

/**
 * A `/start` card linking to one theme.
 *
 * @remarks
 * Compact on phones (icon, title, question count) so two fit side by side;
 * the description appears from the `sm` breakpoint up.
 */
export function ThemeCard({ theme }: Readonly<ThemeCardProps>) {
  const count = theme.prompts.length;

  return (
    <Link
      href={`/start/${theme.slug}`}
      className="flex flex-col gap-2 rounded-md p-4 ring-1 ring-foreground/10 transition-colors outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:gap-4"
    >
      <ThemeIcon
        symbol={theme.symbol}
        className="size-6 shrink-0 text-secondary sm:mt-0.5"
      />
      <div className="flex flex-col gap-1.5">
        <h3 className="leading-snug font-semibold">{theme.title}</h3>
        <p className="line-clamp-2 hidden text-sm text-muted-foreground sm:block">
          {theme.description}
        </p>
        <span className="text-xs text-muted-foreground">
          {count} {count === 1 ? "question" : "questions"}
        </span>
      </div>
    </Link>
  );
}
