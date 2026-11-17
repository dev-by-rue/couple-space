# P1-34 · App navigation

[← Board](../board.md) · Size **S** · Gate A

**Goal:** clear, consistent navigation that can grow with the product. Two destinations today, **Home**
(`/couple`, was "Conversations") and **New conversation** (`/start`, was "Start"), driven from one list.
On **phones** they're a **tab bar fixed to the bottom** (today they're hidden in the avatar menu); from the
`sm` breakpoint they're in the header. The current page is highlighted in both.

**Done when:**

- `lib/app-nav.ts` holds the nav items plus `isNavItemActive` and `hasTabBar`, with tests.
- The header nav maps over the items, marks the active one (`aria-current="page"`), and shows only from `sm`.
- The avatar menu no longer repeats the nav links; it keeps notifications, settings and log out.
- `AppTabBar` shows on phones on every app page except inside a conversation, with room left under the page
  and padding for the home indicator.

### Notes

- **"Home", not "Conversations".** The hub holds more than the list (invite state, the start card, later
  Date Night). "Conversations" stays free for session history later.
- **One list, one entry per feature.** Date Night, History or Community each become one more entry in
  `APP_NAV_ITEMS` (label, route, icon). No placeholders for features that don't exist yet; four or five
  items still fit the tab bar.
- **A conversation counts as Home.** `matches: ["/couple", "/conversation"]` highlights Home in the header
  while you're in one; the theme pages (`/start/<slug>`) count as New conversation.
- **No tab bar inside a conversation.** The answer box gets the whole screen, and the bar doesn't sit on top
  of the on-screen keyboard. The header logo still leads home. Change `hasTabBar` if you'd rather keep it.
- **`viewportFit: "cover"`** is needed for `env(safe-area-inset-bottom)` to be non-zero, so the bar clears
  the iPhone home indicator. It also lets the page reach the screen edges; check the header on an iPhone
  (status bar in the installed app, notch in landscape Safari).
- **Icons live with the items** in `lib/app-nav.ts` (`lucide-react` is already a dependency); the tests
  import the file in Node without rendering anything.
- **`usePathname`** is new in this app; it's the standard Next.js hook for the current route.
- **Comments describe behaviour** and don't reference task or decision ids.

Checked on a scratch copy of `main` @ `833d139`: web 26 tests pass (4 files); `check-types` and web lint
clean; formatted with the repo's `.prettierrc`. Independent of P1-33 (no shared files).

---

## Step 1 · Nav items and rules

### `apps/web/lib/app-nav.ts` (new)
```ts
import {
  HouseIcon,
  MessageCirclePlusIcon,
  type LucideIcon,
} from "lucide-react";

export type AppNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Route prefixes that belong to this item, e.g. a conversation belongs to Home. */
  matches: string[];
};

/**
 * The app's main destinations, in order, for the header and the phone tab bar.
 *
 * @remarks
 * A new feature gets a place in the navigation by adding one entry here.
 */
export const APP_NAV_ITEMS: readonly AppNavItem[] = [
  {
    href: "/couple",
    label: "Home",
    icon: HouseIcon,
    matches: ["/couple", "/conversation"],
  },
  {
    href: "/start",
    label: "New conversation",
    icon: MessageCirclePlusIcon,
    matches: ["/start"],
  },
];

/**
 * Says whether a nav item is the one the viewer is on.
 *
 * @remarks
 * Matches whole path segments, so `/start/some-theme` belongs to `/start` but
 * `/starter` doesn't.
 *
 * @param pathname - The current path, from `usePathname()`
 * @param item - The nav item to check
 * @returns `true` when the path is one of the item's routes or below one
 */
export function isNavItemActive(
  pathname: string,
  item: Pick<AppNavItem, "matches">,
): boolean {
  return item.matches.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Says whether the phone tab bar shows on a page.
 *
 * @remarks
 * Hidden inside a conversation, so the answer box has the whole screen and the
 * bar doesn't sit on top of the on-screen keyboard. The header's logo still
 * leads home.
 *
 * @param pathname - The current path, from `usePathname()`
 * @returns `false` on conversation pages, `true` everywhere else
 */
export function hasTabBar(pathname: string): boolean {
  return !pathname.startsWith("/conversation/");
}
```

### `apps/web/lib/app-nav.test.ts` (new)
```ts
import { describe, expect, it } from "vitest";
import { APP_NAV_ITEMS, hasTabBar, isNavItemActive } from "./app-nav";

const [home, newConversation] = APP_NAV_ITEMS;

describe("isNavItemActive", () => {
  it("matches an item's own route", () => {
    expect(isNavItemActive("/couple", home!)).toBe(true);
    expect(isNavItemActive("/start", newConversation!)).toBe(true);
  });

  it("matches the pages below it", () => {
    expect(isNavItemActive("/start/say-it-softly", newConversation!)).toBe(
      true,
    );
    expect(isNavItemActive("/conversation/abc", home!)).toBe(true);
  });

  it("doesn't match a route that only starts with the same letters", () => {
    expect(isNavItemActive("/starter", newConversation!)).toBe(false);
  });

  it("matches nothing on settings", () => {
    expect(
      APP_NAV_ITEMS.some((item) => isNavItemActive("/settings", item)),
    ).toBe(false);
  });
});

describe("hasTabBar", () => {
  it("shows on the main pages and hides inside a conversation", () => {
    expect(hasTabBar("/couple")).toBe(true);
    expect(hasTabBar("/start/say-it-softly")).toBe(true);
    expect(hasTabBar("/settings")).toBe(true);
    expect(hasTabBar("/conversation/abc")).toBe(false);
  });
});
```

---

## Step 2 · Phone tab bar

### `apps/web/components/organisms/app-tab-bar/app-tab-bar.tsx` (new)
```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAV_ITEMS, isNavItemActive } from "@/lib/app-nav";
import { cn } from "@/lib/utils";

/**
 * The phone navigation: a bar fixed to the bottom of the screen.
 *
 * @remarks
 * Phones only; from the `sm` breakpoint the header shows the same items. It
 * pads for the home indicator on phones without a home button. The layout
 * decides on which pages it shows and leaves room for it.
 */
export function AppTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-primary/20 bg-background pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      <ul className="flex">
        {APP_NAV_ITEMS.map((item) => {
          const active = isNavItemActive(pathname, item);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 text-xs font-medium outline-none focus-visible:bg-muted",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon aria-hidden="true" className="size-5" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

---

## Step 3 · Header

### `apps/web/components/organisms/app-header/app-header.tsx` (change)

**Imports, before**
```tsx
import { useRouter } from "next/navigation";
```
**After**
```tsx
import { usePathname, useRouter } from "next/navigation";
```
**Before**
```tsx
import { cn } from "@/lib/utils";
```
**After**
```tsx
import { APP_NAV_ITEMS, isNavItemActive } from "@/lib/app-nav";
import { cn } from "@/lib/utils";
```

**Hooks, before**
```tsx
  const router = useRouter();
```
**After**
```tsx
  const router = useRouter();
  const pathname = usePathname();
```

**The nav, before**
```tsx
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
```
**After**
```tsx
      {/* Phones use the tab bar at the bottom instead. */}
      <nav aria-label="Main" className="hidden items-center gap-2 sm:flex">
        {APP_NAV_ITEMS.map((item) => {
          const active = isNavItemActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                buttonVariants({ variant: "ghost" }),
                active && "bg-muted text-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
```

**The avatar menu: delete the phone-only nav group** (the tab bar replaces it). Remove these lines:
```tsx
          <DropdownMenuSeparator className="sm:hidden" />
          <DropdownMenuGroup className="sm:hidden">
            <DropdownMenuItem render={<Link href="/couple" />}>
              Conversations
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/start" />}>
              Start
            </DropdownMenuItem>
          </DropdownMenuGroup>
```

---

## Step 4 · Layouts

### `apps/web/app/(app)/layout.tsx` (change)

**Imports, before**
```tsx
import { redirect } from "next/navigation";
import { useMeQuery } from "@/hooks/use-me";
import { AppHeader } from "@/components/organisms/app-header/app-header";
```
**After**
```tsx
import { redirect, usePathname } from "next/navigation";
import { useMeQuery } from "@/hooks/use-me";
import { AppHeader } from "@/components/organisms/app-header/app-header";
import { AppTabBar } from "@/components/organisms/app-tab-bar/app-tab-bar";
import { hasTabBar } from "@/lib/app-nav";
import { cn } from "@/lib/utils";
```

**Hooks, before** (hooks go above the early returns)
```tsx
  const me = useMeQuery();
```
**After**
```tsx
  const me = useMeQuery();
  const pathname = usePathname();
  const tabBar = hasTabBar(pathname);
```

**The return, before**
```tsx
  return (
    <>
      <AppHeader />
      {children}
    </>
  );
```
**After**
```tsx
  return (
    <>
      <AppHeader />
      {/* Leaves room under the page for the phone tab bar and the home indicator. */}
      <div
        className={cn(
          "flex flex-1 flex-col",
          tabBar && "pb-[calc(3.5rem+env(safe-area-inset-bottom))] sm:pb-0",
        )}
      >
        {children}
      </div>
      {tabBar ? <AppTabBar /> : null}
    </>
  );
```
`3.5rem` is the bar's height (`min-h-14`); keep the two in step.

### `apps/web/app/layout.tsx` (change)
**Before**
```tsx
export const viewport: Viewport = {
  themeColor: "#F7F3F0",
};
```
**After**
```tsx
export const viewport: Viewport = {
  themeColor: "#F7F3F0",
  // Lets the page reach the screen edges so the tab bar can pad for the home
  // indicator with `env(safe-area-inset-bottom)`.
  viewportFit: "cover",
};
```

---

## Verification

1. `pnpm --filter @couple-space/web test` → 4 files, 26 tests (21 + 5). `pnpm check-types` and
   `pnpm --filter web lint` clean.
2. **Desktop** (`sm` and wider): the header shows Home and New conversation; the current one is highlighted,
   Home also inside a conversation and New conversation on a theme page. No tab bar.
3. **Phone** (browser dev tools at 375px, then a real phone with the installed app):
   - A tab bar at the bottom on Home, New conversation, a theme page and Settings; the active tab is in the
     primary colour.
   - The last card on Home and the "Show more" button on a theme page aren't hidden behind the bar.
   - No tab bar inside a conversation; the answer box and keyboard have the full screen.
   - On an iPhone, the bar clears the home indicator, and the header isn't under the status bar.
   - The avatar menu shows the name, notifications, Settings and Log out only.
4. Keyboard: Tab reaches the nav links in order; the active one is announced as the current page.
