# P1-25 · Installable app

[← Phase 1](../phase-1-mvp-1.md) · Size **S** · Gate A · Decision: [Q23](../../03-product-decisions.md#q23) · Next: [P1-26](P1-26-push-api.md)

**Goal:** you can both add Couple Space to your phone's home screen, and it opens full screen with its own
icon and name, like an app.

**Done when:**

- Chrome on Android offers "Install app", and the installed app opens without browser bars.
- On iPhone, Safari → Share → **Add to Home Screen** gives a proper icon and opens full screen.
- `https://<web>/manifest.webmanifest` returns the manifest on Railway.

No API or database change. Nothing here needs a test runner: it's config and static files, checked by hand
(the web app has no test setup).

---

## What already exists

| Thing | Where | Notes |
| --- | --- | --- |
| Root metadata | `apps/web/app/layout.tsx` | `metadata` has only `title` and `description` |
| Favicon | `apps/web/app/favicon.ico` | Too small for a home-screen icon |
| `public/` | `apps/web/public/` | Only the default Next SVGs |

---

## Steps

### Step 1 · Icons

Make four PNGs from your logo and put them in `apps/web/public/icons/`:

| File | Size | Notes |
| --- | --- | --- |
| `icon-192.png` | 192×192 | Android home screen |
| `icon-512.png` | 512×512 | Android splash screen and install dialog |
| `icon-maskable-512.png` | 512×512 | Same art with ~20% padding on a solid background. Android crops it into a circle or squircle |
| `apple-touch-icon.png` | 180×180 | iPhone. Solid background, no transparency (iOS fills transparent areas with black) |

Any image editor works. [maskable.app](https://maskable.app/editor) previews the maskable crop.

### Step 2 · The manifest

New file `apps/web/app/manifest.ts`. Next serves it at `/manifest.webmanifest` and adds the `<link>` tag
for you.

```ts
import type { MetadataRoute } from "next";

/**
 * Web app manifest, which makes the app installable to a phone's home screen.
 *
 * @remarks
 * `start_url` is the hub. If the person is logged out, the `(app)` layout
 * sends them to `/login` as usual. Colours match the `harbor` palette
 * background so the splash screen doesn't flash white.
 *
 * @returns The manifest Next serves at `/manifest.webmanifest`
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Couple Space",
    short_name: "Couple Space",
    description: "Private couple space",
    start_url: "/couple",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
```

Replace both `#ffffff` values with your `harbor` background colour from `globals.css` (as a hex value, since
the manifest doesn't understand CSS variables or `oklch`).

This is a default export, which `apps/web/CLAUDE.md` only allows where Next requires it. `manifest.ts` is
one of those files.

### Step 3 · Apple metadata and theme colour

In `apps/web/app/layout.tsx`, extend `metadata` and add a `viewport` export.

Before:

```tsx
import type { Metadata } from "next";
…
export const metadata: Metadata = {
  title: "Couple Space",
  description: "Private couple space",
};
```

After:

```tsx
import type { Metadata, Viewport } from "next";
…
export const metadata: Metadata = {
  title: "Couple Space",
  description: "Private couple space",
  applicationName: "Couple Space",
  appleWebApp: {
    capable: true,
    title: "Couple Space",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};
```

Use the same colour as `theme_color` in the manifest. `appleWebApp.capable` is what makes the iPhone home
screen version open full screen. It's also what lets iOS deliver web push later (P1-27).

---

## Check

1. `pnpm --filter @couple-space/web dev`, open `http://localhost:3000/manifest.webmanifest`. You should see
   the JSON above.
2. Chrome DevTools → **Application → Manifest**: no errors, all three icons shown.
3. Deploy to Railway. On Android Chrome, open the site, then **⋮ → Install app**. On iPhone Safari,
   **Share → Add to Home Screen**. Open it from the home screen: no address bar, and logging in works
   (cookies go through `/backend` on the same origin, so nothing changes).
4. `pnpm check-types` and `pnpm --filter @couple-space/web lint` pass.

Commit: `feat(web): P1-25 installable app manifest`.
