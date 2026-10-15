# Legal and business

[← Plan index](../README.md) · Follows from the [owner answers](../04-owner-answers.md)

These are research tasks, not code. They're things to find out, **not legal advice**: check each one
against the official source.

## Legal (required for [Gate B](../02-mvp-and-release-gates.md#release-gates))

Not needed for Gate A (you, your partner, your cousin and his wife).

- [ ] **L-1 · Trading structure** — Decide between sole trader and limited company. Ask specifically about personal liability, given the app holds intimate data. Sources: gov.uk "Set up as a sole trader" and "Set up a limited company".
- [ ] **L-2 · ICO fee** — Check whether you need to pay the ICO data protection fee (ico.org.uk has a short self-assessment).
- [ ] **L-3 · ⚠️ Special category data** — Answers about sex life and relationships are likely "special category" data under UK GDPR (Article 9). That normally needs **explicit consent** and extra safeguards. Read the ICO guidance on special category data before Gate B. It may add an explicit consent step to registration and affect [Q17](../03-product-decisions.md#q17) (encryption).
- [ ] **L-4 · DPIA** — A data protection impact assessment. The ICO has a template, and for this kind of data one is likely expected. It's also a good way to stress-test [Q7](../03-product-decisions.md#q7), [Q8](../03-product-decisions.md#q8), [Q17](../03-product-decisions.md#q17) and [Q18](../03-product-decisions.md#q18).
- [ ] **L-5 · Privacy policy + terms** — Written against L-1…L-4 and naming the EU data region. This is the content for [P1-13](phase-1-mvp-1.md#safety-privacy-legal).

## Monetisation (after Gate A)

- [ ] **M-1 · Research models** — Look for models that don't distort the private experience, such as a per-couple subscription or paid journeys/themes. Write the findings into [`future-roadmap.md`](../../product/future-roadmap.md). Nothing in the schema changes until a model is chosen ([E-10](../erd/design-review.md#e-10)).
