/**
 * Web auth uses Nest httpOnly cookies (cs_access / cs_refresh).
 * Always include credentials so the browser sends cookies cross-origin to the API.
 * Do NOT store access tokens in localStorage for the web client.
 *
 * React Query should call this from queryFn / mutationFn — not replace it.
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
