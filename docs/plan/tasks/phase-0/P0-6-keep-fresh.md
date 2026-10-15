# P0-6 · Keep both screens fresh

[← Phase 0](../phase-0-core-loop.md) · Size **S** · Depends on: [P0-3](P0-3-waiting-state.md) · Decision: [Q6](../../03-product-decisions.md#q6)

**Goal:** when your partner answers, your waiting screen moves to "Reveal" without you reloading.

**Done when:**
- While you're waiting, the session page checks every 20 seconds, and only while the tab is visible.
- Switching back to the tab refreshes the session and the hub immediately.
- No polling happens in any other phase.

---

## What already exists

| Thing | Where | Notes |
| --- | --- | --- |
| Query client defaults | `components/providers.tsx` | `staleTime: 30_000`, `retry: false`. A 30-second stale time means switching back to the tab **does nothing** for 30 seconds, so these two queries override it |
| `useSessionQuery`, `useSessionsQuery` | `hooks/use-sessions.ts` | Only these two change |

There's no prototype equivalent; the prototype runs on in-memory mock state.

---

## Steps

### Step 1 · Session detail: poll only while waiting

In `apps/web/hooks/use-sessions.ts`, replace `useSessionQuery`:

```ts
/** How often the session page re-checks while waiting on the partner. */
const WAITING_POLL_MS = 20_000;

/**
 * Loads one session for the viewer, keeping it fresh while they wait.
 *
 * @remarks
 * There are no notifications yet (Q6), so the page polls, but only in
 * `waiting_for_partner`, the one phase where the partner's action changes
 * what the viewer sees. React Query pauses polling in background tabs.
 *
 * @param id - Session id from the route
 * @returns The React Query result for `GET /sessions/:id`
 */
export function useSessionQuery(id: string) {
  return useQuery({
    queryKey: sessionQueryKey(id),
    queryFn: () => apiFetch<SessionDetailDto>(`/sessions/${id}`),
    enabled: Boolean(id),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: (query) =>
      query.state.data?.phase === "waiting_for_partner"
        ? WAITING_POLL_MS
        : false,
  });
}
```

### Step 2 · Hub list: refresh when you come back to it

Same file, in `useSessionsQuery`, add `staleTime: 0` so returning to `/couple` (or the tab) shows current statuses:

```ts
export function useSessionsQuery() {
  return useQuery({
    queryKey: SESSIONS_QUERY_KEY,
    queryFn: () => apiFetch<SessionsResponse>("/sessions"),
    select: (data) => sortSessionsByPriority(data.sessions),
    staleTime: 0,
  });
}
```

---

## Check

1. Two browsers. A submits and sits on the waiting screen. B submits. Within about 20 seconds A's screen changes to the Reveal button.
2. A switches to another tab and back: it refreshes straight away.
3. Network tab while in `answering`, `ready_to_reveal` or `revealed`: no repeating `GET /sessions/:id`.
4. Background the waiting tab for a minute: no requests until you come back.

## Pitfalls

- `refetchInterval` as a function is React Query v5 syntax (`(query) => …`); you're on v5.102.
- Don't poll `ready_to_reveal`. Your partner revealing doesn't change what you see.
