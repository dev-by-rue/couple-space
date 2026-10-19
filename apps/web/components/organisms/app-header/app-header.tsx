"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useMeQuery } from "@/hooks/use-me";
import { useLogoutMutation } from "@/hooks/use-auth-mutations";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function AppHeader() {
  const me = useMeQuery();
  const router = useRouter();
  const queryClient = useQueryClient();
  const logout = useLogoutMutation({
    onSettled: () => {
      router.replace("/login");
      queryClient.clear();
    },
  });

  if (!me.data) return null;

  return (
    <header className="flex items-center justify-between gap-4 border-b px-6 py-3">
      <Link href="/couple" className="mr-4 font-display text-lg">
        Couple Space
      </Link>
      <nav className="flex items-center gap-2">
        <Link
          href="/couple"
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "hidden sm:inline-flex",
          )}
        >
          Conversations
        </Link>
        <Link
          href="/start"
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "hidden sm:inline-flex",
          )}
        >
          Start
        </Link>
      </nav>

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Account menu"
          className="grid size-9 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
        >
          {me.data.displayName.slice(0, 1)}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              <p>{me.data.displayName}</p>
              <p className="text-muted-foreground">{me.data.email}</p>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator className="sm:hidden" />
          <DropdownMenuGroup className="sm:hidden">
            <DropdownMenuItem render={<Link href="/couple" />}>
              Conversations
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/start" />}>
              Start
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
          >
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
