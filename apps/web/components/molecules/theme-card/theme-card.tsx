import type { ThemeDto } from "@/hooks/use-themes";
import Link from "next/link";
import { ThemeIcon } from "@/components/molecules/theme-icon/theme-icon";

type ThemeCardProps = {
  theme: ThemeDto;
};

export function ThemeCard({ theme }: Readonly<ThemeCardProps>) {
  return (
    <Link
      href={`/start/${theme.slug}`}
      className="flex gap-2 ring-1 ring-foreground/10 rounded-md p-4 transition-colors outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex gap-4">
        <div className="flex p-1 justify-center">
          <ThemeIcon symbol={theme.symbol} className="size-6 text-secondary" />
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="font-semibold leading-snug">{theme.title}</h3>
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {theme.description}
          </p>
        </div>
      </div>
    </Link>
  );
}
