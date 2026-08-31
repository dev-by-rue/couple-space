/**
 * Only allow same-origin relative paths for post-auth redirects.
 * Blocks open redirects (`//evil.com`, `https://…`).
 */
export function safeNextPath(
  next: string | null | undefined,
  fallback = "/couple",
): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}

export function withNextQuery(href: string, next: string): string {
  if (next === "/couple") return href;
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}next=${encodeURIComponent(next)}`;
}
