/**
 * Returns a safe, same-origin path to redirect to after login or register.
 *
 * @remarks
 * Only relative paths starting with a single `/` are allowed. This blocks
 * open redirects such as `//evil.com` or `https://…`.
 *
 * @param next - The requested redirect path, usually from the `next` query param
 * @param fallback - Where to go when `next` is missing or unsafe
 * @returns `next` if it is safe, otherwise `fallback`
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
