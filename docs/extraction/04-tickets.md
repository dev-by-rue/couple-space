# Tickets — conversation extraction wave

Vertical, independently deliverable slices. Ordered by dependency.  
You implement; Nest owns rules. Fixtures allowed only if shaped like the **final** contract (no auto-reveal).

---

## Suggested build order

1. **T0 ★ Walking skeleton** (blocked on Nest session+reveal contract or matching fixtures)  
2. **T1** Hub invite-pending parity (can parallelise UI after T0 hub shell exists)  
3. **T2** Token semantic map + multi-theme test harness (parallel anytime)  
4. **T3** Custom propose / accept-discard / queue (cap 3)  
5. **T4** Anonymous partner prompts in `/start` catalog + attribution after dual reveal  
6. **T5** Optional discussion (follow-ups + offline CTA)  
7. **T6** Hardening (a11y, empty/error polish, motion)

Promote `scope.md` before or with T3–T4 (open questions in `03-requirements.md`).

---

## T0 ★ Walking skeleton — curated loop with per-user Reveal

**Description:** Smallest end-to-end path for an **active** couple: hub → curated `/start` → session answer → wait → **Reveal** (self) → see answers → list status truthful. Final-shaped privacy; no throwaway auto-reveal.

**Acceptance**
- Given an active couple, when they open `/couple`, then they see Start + conversation list (empty OK).
- Given they start a curated prompt, when session opens, then they can compose and confirm-submit an answer.
- Given only one has submitted, when either views the session, then partner answer text is not visible (API redacted).
- Given both submitted and viewer has not revealed, when they view the session, then they see **Reveal** and still no partner (or own shared) answer content per Nest rules.
- Given viewer taps Reveal, when the payload refreshes, then they see both answers; the other user remains unrevealed until they tap Reveal.
- Given either user returns to hub, when the list loads, then status matches their perspective.
- Given couple is not active, when they hit Start entry points, then start is blocked (may be minimal in T0 if T1 owns polish).

**Requirements:** FR-01, FR-05–07, FR-12–18; NFR-04–05  
**Extraction map:** Hub page, ConversationCard/StatusPill, ThemeCard, prompt list, session answer form, WaitingState, Reveal button/panel, AnswerCard, PageSkeleton; hooks for themes/sessions; **skip** PrototypeControls, DirectedQuestionCard, auto RevealPanel behaviour  
**Test approach:** Nest/domain Vitest for submit immutability + redaction + per-user reveal; manual two-browser web smoke  
**Size:** L (M if Nest contract already drafted)  
**Blockers:** Nest (or fixtures) for session create, submit, get (redacted), reveal  

---

## T1 — Hub invite-pending parity

**Description:** Evolve `/couple` invite-pending state to match prototype calm waiting + education, composed from **existing** formation APIs/components (not Lovable invite stubs).

**Acceptance**
- Given invite pending, when hub loads, then Start is disabled with clear reason; education/Steps visible.
- Given real invite link/resend, when user acts, then Nest-backed behaviour runs (no `example.com`).
- Given couple becomes active, when hub refreshes, then active hub from T0 appears.

**Requirements:** FR-02–04; FR-05 (active already in T0)  
**Extraction map:** Steps; compose InvitePartnerForm / InviteLinkDisplay; adapt CoupleMark/welcome  
**Test approach:** Manual formation smoke (`docs/engineering/auth-manual-smoke.md` patterns)  
**Size:** M  
**Blockers:** T0 hub shell helpful but formation APIs exist now  

---

## T2 — Semantic tokens + multi-theme test pattern

**Description:** Keep default `apps/web` brand. Document/implement CSS-variable mapping for prototype intents (especially waiting). Optional theme switch for testing colour feels without forking components.

**Acceptance**
- Given default theme, when app loads, then current brand unchanged.
- Given a second theme class/attribute, when toggled (dev/test), then the same components pick up new values via shared var names.
- Waiting / soft surfaces use semantic roles, not one-off hex in organisms.

**Requirements:** NFR-07  
**Extraction map:** Token adoption section; waiting tokens; reveal motion optional  
**Test approach:** Visual check light/dark + second theme  
**Size:** S–M  
**Blockers:** None (parallel)  

---

## T3 — Custom prompt propose / accept-discard / queue (cap 3)

**Description:** Custom tab/composer proposes; partner accepts or discards; per-partner cap of 3 pending/queued customs; accepted items enter queue without instant force-start unless product says so.

**Acceptance**
- Given a partner has 3 customs pending/queued, when they try another, then create is rejected with clear UI.
- Given a proposal, when partner discards, then it does not become a session/catalog item.
- Given accept, when queue/hub updates, then both can see it in the agreed list/queue UX.
- Given prototype instant-start path, when implementing, then it is **not** used.

**Requirements:** FR-08–09; resolves scope open question on acceptance  
**Extraction map:** PromptComposer; start custom tab; Nest propose/accept APIs  
**Test approach:** Domain tests for cap + accept/discard; manual queue UX  
**Size:** L  
**Blockers:** Nest proposal model; prefer `scope.md` update; T0 catalog patterns  

---

## T4 — Anonymous partner prompts on `/start`

**Description:** Eligible partner-created prompts mix into curated catalog without authorship. After both answered and each revealed, show **partner-created**. Shapes data for future cross-couple without building community now.

**Acceptance**
- Given a partner-created eligible prompt, when the other browses `/start`, then it is indistinguishable from curated (no name/badge).
- Given both submitted and both revealed, when either views the session, then partner-created attribution is visible.
- Given pre-reveal, when inspecting network payloads, then authorship is not leaked to the non-author inappropriately (Nest rule — document exact policy).

**Requirements:** FR-10–11; NFR-05  
**Extraction map:** Prompt list; catalog DTO; **no** DirectedQuestionCard  
**Test approach:** API tests for attribution hiding; manual catalog + post-reveal label  
**Size:** L  
**Blockers:** T3 (if customs feed the pool); Nest attribution; **scope.md promotion**  

---

## T5 — Optional discussion after both revealed

**Description:** After both Reveals, show optional curated follow-ups and offline encouragement. No mandatory quiz; no DM thread; no prototype directed-card MVP.

**Acceptance**
- Given only one has revealed, when they view the session, then discussion section is hidden.
- Given both revealed, when they view, then optional follow-ups and offline CTA appear.
- Given they ignore follow-ups, when they leave, then no error / blocked state.
- Given they answer a follow-up, when partner has not, then soft-lock holds.

**Requirements:** FR-19–23  
**Extraction map:** FollowUpCard (adapt); offline copy; skip DirectedQuestionCard  
**Test approach:** Manual state matrix; API soft-lock for follow-ups  
**Size:** M–L  
**Blockers:** T0 reveal semantics; Nest follow-up packaging  

---

## T6 — Hardening

**Description:** Loading/empty/error polish, focus/reduced-motion, status copy audit, remove debug leftovers (e.g. `console.log` on couple page).

**Acceptance**
- Given slow network, when navigating hub/start/session, then skeletons/pending UI show.
- Given missing session id, when opening conversation, then not-found + path home.
- Given reduced motion, when reveal animates, then motion is suppressed or minimal.
- Keyboard: submit, reveal, dismiss welcome operable.

**Requirements:** NFR-01–04  
**Extraction map:** PageSkeleton; focus/ring tokens from prototype as reference  
**Test approach:** Manual a11y pass; lint clean  
**Size:** S–M  
**Blockers:** T0–T5 surfaces exist  

---

## Traceability (summary)

| Ticket | FR IDs (primary) |
|--------|------------------|
| T0 ★ | FR-01, 05–07, 12–18 |
| T1 | FR-02–04 |
| T2 | NFR-07 |
| T3 | FR-08–09 |
| T4 | FR-10–11 |
| T5 | FR-19–23 |
| T6 | NFR-01–04 |

FR-24 applies globally (do not expand scope in these tickets).
