# 04 · Owner answers

[← Plan index](README.md) · Answered 2026-10-15

These depend on facts about you rather than product choices, so the client couldn't decide them.

## O-1

**Legal entity / jurisdiction.** Not trading yet. UK-based and at the idea stage. You'll research sole
trader vs other options as you go.

**What it means:** no legal entity is needed to build, or to test with family. Setting one up becomes a
**gate before any couple you don't personally know signs up** ([Gate B](02-mvp-and-release-gates.md#release-gates)),
covered by tasks [L-1…L-5](tasks/legal-and-business.md).

## O-2

**Data region.** Pin data to an **EU region**. Users for now: you and your partner, then your cousin and
his wife. Nobody else.

**What it means:** move the Railway services to an EU region now, while there's no data worth keeping
([P0-10](tasks/phase-0-core-loop.md)). The first release is a **family alpha** of two couples (Gate A), not a
3–5 couple beta.

## O-3

**Monetisation.** Undecided. You'll research it, and you believe the idea is viable.

**What it means:** build nothing for it. Keep [E-10](erd/design-review.md#e-10): never put plan or billing
columns on `users`; if billing comes, it hangs off `couples`. Research task
[M-1](tasks/legal-and-business.md) comes after Gate A.
