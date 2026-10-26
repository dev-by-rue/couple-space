# 02 · MVP and release gates

[← Plan index](README.md)

## MVP releases

🟢 **Client decision.**

`scope.md` currently defines MVP as **five** slices: formation → conversation engine → community →
publishing → moderation. For a solo maintainer, that's a long road before a real couple can use anything.
The scope's own principle says _"private couple experience must provide value even if the community has
zero contributions"_. Community without working moderation tooling is also the riskiest thing you could ship.

The MVP is split into three releases, each shippable on its own:

| Release                    | Goal                                                         | Contains                                                                                                                               | Ships to                    | Tasks                                                                    |
| -------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------ |
| **MVP-1 · Private**        | A real couple can complete the core loop and come back to it | Formation (done) · full conversation loop · curated follow-ups · completion (archiving moved to the roadmap, Q4) · account essentials · safety/legal · ops basics | Gate A, then Gate B (below) | [Phase 0](tasks/phase-0-core-loop.md), [Phase 1](tasks/phase-1-mvp-1.md) |
| **MVP-2 · Couple-created** | Couples can bring their own subjects                         | Custom prompt propose/accept (T3) · anonymous partner prompts on `/start` (T4) · partner-added discussion questions                    | Same couples, wider         | [Phase 2](tasks/phase-2-couple-created.md)                               |
| **MVP-3 · Community**      | Opt-in sharing between couples                               | Community profile opt-in · joint-approval publishing · reporting · moderation + enforcement                                            | Public launch               | [Phase 3](tasks/phase-3-community.md)                                    |

## Release gates

🟢 **Client decision.**

This follows from the owner's answers [O-1 and O-2](04-owner-answers.md). The first users are two couples
you know personally, so MVP-1 ships in two gates and you can use the app with your partner much sooner:

| Gate                  | Who                                  | Must be done                                                                                                                                                                                                                                   |
| --------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A · Family alpha**  | You + partner, then cousin + wife    | All of [Phase 0](tasks/phase-0-core-loop.md) (incl. P0-10 EU region) · [H-11, H-12, H-2](tasks/housekeeping.md) · P1-1 logout · P1-3 error copy · P1-8 follow-ups · P1-6 completion · P1-19 backups · P1-21 enough prompts to last a few weeks |
| **B · Stranger beta** | Any couple you don't know personally | Everything else in [Phase 1](tasks/phase-1-mvp-1.md) **plus** [L-1…L-5](tasks/legal-and-business.md)                                                                                                                                           |

At Gate A, `SANDBOX_AUTO_VERIFY` can stay on and password reset can be "message me", because you know
everyone. At Gate B neither is acceptable.

## Scope updates

What this changes in `scope.md`:

- [x] **D-1** Promote the three-release split into `scope.md` → "MVP foundation (implementation order)". Community stays MVP for _public launch_, just not for the first releases. Add the two gates.
- [x] **D-2** Move "custom prompts" from MVP-1 to MVP-2 (the walking skeleton is curated-only anyway).
- [x] **D-3** State that "guided discussion" in MVP-1 means **curated follow-ups only**. Partner-added questions arrive with MVP-2 as _both-answer_ child sessions ([Q21](03-product-decisions.md#q21), [Q22](03-product-decisions.md#q22)), replacing the "directed" model.
- [x] **D-4** Copy the product decisions into `scope.md`: see [03 · D-4](03-product-decisions.md#d-4).
