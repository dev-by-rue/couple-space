/**
 * Calls the Nest API with the browser's auth cookies and parses the JSON reply.
 *
 * @remarks
 * Web auth uses Nest httpOnly cookies (`cs_access` / `cs_refresh`), so every
 * request sends `credentials: "include"`. Never store access tokens in
 * `localStorage` for the web client. Call this from React Query's
 * `queryFn` / `mutationFn` — don't replace React Query with it.
 *
 * @param path - API path starting with `/`, e.g. `/sessions`
 * @param init - Extra `fetch` options (method, body, headers)
 * @returns The parsed JSON body, or `undefined` for a 204 response
 * @throws `Error` with the status and body text when the response isn't OK
 */
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
  const res = await fetch(`${base}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}
