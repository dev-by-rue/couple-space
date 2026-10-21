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
    background_color: "#F7F3F0",
    theme_color: "#F7F3F0",

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
