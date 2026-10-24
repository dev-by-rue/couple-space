# Phase 1 · MVP-1 (family alpha → private beta)

[← Plan index](../README.md) · Release: MVP-1

**Goal:** something you can hand to a real couple without hand-holding or embarrassment.

Tasks marked **🅰** are needed for [Gate A](../02-mvp-and-release-gates.md#release-gates) (family alpha).
Everything else is needed for Gate B (couples you don't know personally).

Tasks with a 📘 link have a guide with full before/after code and tests (P1-2 is prototype reuse notes only).

**Guide order.** Each guide's "before" code assumes the earlier guides are already applied:
P1-4 → P1-5 → P1-9 → P1-15 → P1-16 → P1-10 → P1-8 → P1-6 → P1-7 → P1-11 → P1-12 → P1-13 → P1-14 → P1-17 → P1-18 → P1-20.
Each guide also has a "Flags" section listing open product decisions. Settle those before you build that task.

---

## Navigation & account

- [x] **P1-1 · App header + logout** 🅰 · S — In `(app)/layout.tsx`: brand, "Conversations", "Start", and an account menu with **Log out**. `POST /logout` exists, but no web UI calls it today.
- [x] **P1-2 · Hub invite-pending parity (T1)** · M · [📘 prototype reuse](phase-1/P1-2-hub-invite-pending.md) — See [`04-tickets.md` T1](../../extraction/04-tickets.md). Start disabled with a reason; steps/education; resend and revoke invite.
- [x] **P1-3 · Replace placeholder error/empty copy** 🅰 · S — `/couple`, `/start`, `/start/[slug]` ("Error loading themes") and the conversation page. Remove the `!` non-null assertion in `start/[slug]/page.tsx`.
- [ ] **P1-4 · Settings page `/settings`** · M · [📘 guide](phase-1/P1-4-settings.md) — Change display name (`PATCH /users/me`, rules in [Q20](../03-product-decisions.md#q20)); change password (`POST /auth/change-password`, which revokes other refresh tokens).
- [ ] **P1-5 · Password reset** · M · [📘 guide](phase-1/P1-5-password-reset.md) — `password_reset_tokens` table ([ERD](../erd/mvp-1.md)), stored as a hash like `email_verification_tokens`. `POST /forgot-password`, `POST /reset-password`, web pages, and revoke all refresh tokens on success. Always return 200 from forgot-password so it can't be used to check which emails have accounts. At Gate A this can be "message me".

## Conversation engine completion

- [ ] **P1-8 · Curated follow-ups (T5)** 🅰 · L · [📘 guide](phase-1/P1-8-follow-ups.md) — Follow-ups are _child sessions_ ([ERD MVP-1](../erd/mvp-1.md)), so the hidden-until-both-submit rule is reused unchanged. Per [Q22](../03-product-decisions.md#q22), child sessions **skip the reveal step**: `canViewerSeeAnswerText` treats "both submitted" as visible when `parent_session_id` is set, and `sessionViewerPhase` goes from `waiting_for_partner` straight to `revealed` for children (no `ready_to_reveal`). No `session_reveals` rows for children.
  - Schema: `prompts.parent_prompt_id`, `kind = 'follow_up'`; `conversation_sessions.parent_session_id`. One level only ([E-12](../erd/design-review.md#e-12)).
  - Seed: 2–3 follow-ups per curated prompt in `catalogue.data.ts`.
  - API: `GET /sessions/:id` includes `followUps` only when **both** have revealed (FR-19); `POST /sessions/:id/follow-ups` `{ promptId }` creates the child session; `GET /sessions` excludes children.
  - Web: an optional follow-up list and a "take it offline" card under the revealed answers (FR-20, FR-22). Reuse the answering and waiting components for the child.
  - Domain tests: follow-ups hidden until both revealed the main prompt; child answers hidden until both submitted; child answers visible to both right after the second submit, with no reveal row.
- [ ] **P1-6 · Session completion ([Q1](../03-product-decisions.md#q1))** 🅰 · M · [📘 guide](phase-1/P1-6-session-completion.md) — A couple-level session state derived from the main session and its child sessions: `in_progress` → `in_discussion` → `completed`. Domain function and tests in `packages/domain`. Hub: active sessions (including "In discussion") first, then completed ones in a "Past conversations" section. **Depends on P1-8.**
- [ ] **P1-7 · Skip / archive ([Q3](../03-product-decisions.md#q3), [Q4](../03-product-decisions.md#q4))** · M · [📘 guide](phase-1/P1-7-skip-archive.md) — `conversation_sessions.archived_at`, `archived_by_user_id`, `decline_reason` (enum). Endpoint, hub filter and domain tests. Audit event.

## Safety, privacy, legal

- [ ] **P1-9 · 18+ age gate ([Q9](../03-product-decisions.md#q9))** · S · [📘 guide](phase-1/P1-9-age-gate.md) — Register schema in `packages/domain/src/auth-schemas.ts`, a server-side check, and clear copy.
- [ ] **P1-10 · Real email verification ([Q10](../03-product-decisions.md#q10))** · S · [📘 guide](phase-1/P1-10-real-email-verification.md) — Brevo SMTP on the beta environment; `SANDBOX_AUTO_VERIFY=false`.
- [ ] **P1-11 · Leave couple / dissolution ([Q7](../03-product-decisions.md#q7), [Q18](../03-product-decisions.md#q18), [Q19](../03-product-decisions.md#q19))** · L · [📘 guide](phase-1/P1-11-leave-couple.md) — `POST /couples/me/leave` with confirmation. The statuses already exist in the domain (`dissolving`/`dissolved`, `left`). Block all session endpoints for non-active couples. Audit events, `couples.dissolved_at`, `couple_memberships.left_at` (H-13), and the 30-day purge job ([E-8](../erd/design-review.md#e-8)).
- [ ] **P1-12 · Account deletion ([Q8](../03-product-decisions.md#q8))** · L · [📘 guide](phase-1/P1-12-account-deletion.md) — `DELETE /users/me` with password re-entry. Dissolves the couple and deletes responses and reveals. Audit rows stay but contain no content ([E-7](../erd/design-review.md#e-7)). Add `users.deleted_at` if you want a grace period.
- [ ] **P1-13 · Legal + trust pages** · M · [📘 guide](phase-1/P1-13-legal-trust-pages.md) — Privacy policy, terms, and a "How your answers stay private" explainer (your reveal table in plain English). Written against [L-1…L-5](legal-and-business.md). Data export (`GET /users/me/export`, JSON) is S once P1-12 exists.
- [ ] **P1-14 · Email nudges (optional)** · M · [📘 guide](phase-1/P1-14-email-nudges.md) — Push ([P1-25…P1-27](#notifications-installable-app--push)) covers "new conversation" for Gate A; revisit this after it ships. "Partner answered", "Ready to reveal". **No prompt or answer text in emails** (lock-screen privacy). Needs a `users.email_notifications` boolean.

## Notifications (installable app + push)

Decision: [Q23](../03-product-decisions.md#q23). Web push only, no native app. Do these in order: you can both install the app after P1-25, and pushes start arriving after P1-27.

- [ ] **P1-25 · Installable app** 🅰 · S · [📘 guide](phase-1/P1-25-installable-app.md) — Web app manifest, icons, and Apple web-app metadata, so the app installs to the home screen on iPhone and Android.
- [ ] **P1-26 · Push API** 🅰 · M · [📘 guide](phase-1/P1-26-push-api.md) — `push_subscriptions` table, VAPID keys, `POST`/`DELETE /push/subscriptions`, and a push to the partner when a **new** conversation is created. Dead subscriptions (404/410) are deleted. Domain tests for the subscription schema and the notification text; API tests for sending and cleanup.
- [ ] **P1-27 · Notifications in the app** 🅰 · M · [📘 guide](phase-1/P1-27-push-in-app.md) — A push-only service worker (no offline caching), an "Enable notifications" banner on the hub with the iPhone "Add to Home Screen first" hint, an on/off item in the account menu, and unsubscribing this device on logout. Tapping a notification opens the conversation.

## Security & ops

- [ ] **P1-15 · Rate limiting** · S · [📘 guide](phase-1/P1-15-rate-limiting.md) — `@nestjs/throttler` on login, register, forgot-password, resend-verification and invite accept.
- [ ] **P1-16 · Security headers** · S · [📘 guide](phase-1/P1-16-security-headers.md) — `helmet` on Nest; `headers()` in `next.config.ts` (CSP can come later).
- [ ] **P1-17 · CI** · M · [📘 guide](phase-1/P1-17-ci.md) — GitHub Actions: `pnpm install --frozen-lockfile`, `turbo run check-types lint test`, and a Postgres service for API tests. Branch protection on `main`.
- [ ] **P1-18 · Error monitoring + logs ([Q17](../03-product-decisions.md#q17))** · S · [📘 guide](phase-1/P1-18-error-monitoring.md) — Sentry (or similar) for web and api. Make sure answer bodies are **scrubbed** from error payloads.
- [ ] **P1-19 · Backups** 🅰 · S — Confirm Railway Postgres backups are on, and write the restore steps into `docs/deployment/railway.md`.
- [ ] **P1-20 · Hardening (T6)** · M · [📘 guide](phase-1/P1-20-hardening.md) — Skeletons, keyboard paths (submit, reveal, dismiss welcome), focus rings, reduced motion, mobile widths, and removing stray `console.log`s.

## Content

- [ ] **P1-21 · Write more prompts** 🅰 · M — 6 themes × 3 prompts is thin for repeat use. Aim for ~8–10 per theme, plus follow-ups. Prompt _titles_ are currently auto-generated as `Theme · 2` in the seed; give them real titles.

## Launch

- [ ] **P1-22 · Beta environment** · S — A separate Railway environment and database from the sandbox, in an EU region.
- [ ] **P1-23a · Gate A: family alpha** 🅰 · — You and your partner use it for a couple of weeks, then your cousin and his wife. Keep a simple notes file of friction points.
- [ ] **P1-23b · Gate B: private beta** · — Invite 3–5 couples you don't know personally. Collect feedback with a simple form outside the app (no in-app DM surface).
- [ ] **P1-24 · Review feedback** · S — Revisit [Q2](../03-product-decisions.md#q2), [Q3](../03-product-decisions.md#q3) and [Q6](../03-product-decisions.md#q6), and the MVP-2 plan.
