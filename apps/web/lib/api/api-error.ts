/**
 * Reads the HTTP status out of an error thrown by `apiFetch`
 * 
 * @param error - Any error caught from a query or mutation.
 * @returns The status code, or `undefined` if it is not an API error (eg offline error)
 */
export function apiErrorStatus(error: unknown): number | undefined {
  if (!(error instanceof Error)) return undefined;
  const match = /^API (\d{3}):/.exec(error.message);
  return match ? Number(match[1]) : undefined;
}

/**
 * Reads NestJs `reason` code out of an `apiFetch` error.
 * 
 * @remarks
 * Nest exceptions in this API are thrown as `new Exception({ reason })`,
 * so the response body will be `{ "reason": "..." }`.
 * 
 * @param error - Any error caught from a query or mutation.
 * @returns The reason code, or `undefined` if it is not an API error.
 */
export function apiErrorReason(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;
  const body = error.message.replace(/^API \d{3}:/, "");
  try {
    const parsed = JSON.parse(body) as { reason?: unknown };
    return typeof parsed.reason === "string" ? parsed.reason : undefined;
  } catch {
    return undefined;
  }
}