# ERD · MVP-1 additions

[← Plan index](../README.md) · Builds on: [current schema](current-schema.md) · Tasks: [Phase 1](../tasks/phase-1-mvp-1.md), [Housekeeping](../tasks/housekeeping.md)

Only new or changed parts are shown. 🆕 = new table, ✏️ = new column on an existing table.

```mermaid
erDiagram
    users ||--o{ password_reset_tokens : "owns"
    users ||--o{ prompt_skips : "skips for now"
    prompts ||--o{ prompt_skips : "skipped"

    conversation_sessions {
        index couple_id_prompt_id "✏️ P1-29: (couple_id, prompt_id) for the Q25 checks"
    }
    prompt_skips {
        uuid id PK "🆕 P1-29 (Q24, Q25)"
        uuid user_id FK "on delete cascade"
        uuid prompt_id FK
        timestamptz skipped_until "now + SKIP_FOR_NOW_HOURS"
    }
    password_reset_tokens {
        uuid id PK "🆕"
        uuid user_id FK
        text token_hash UK
        timestamptz expires_at
        timestamptz used_at
        timestamptz created_at
    }
    couples {
        timestamptz dissolved_at "✏️ Q7, drives 30-day purge (E-8)"
    }
    couple_memberships {
        timestamptz left_at "✏️ E-4"
    }
    session_responses {
        text body "✏️ CHECK length <= 5000 (Q16)"
    }
    users {
        timestamptz deleted_at "✏️ Q8 (only if you want a grace period)"
        boolean email_notifications "✏️ P1-14 (optional)"
    }
```

*Updated 2026-10-26:* follow-ups (`parent_prompt_id`, `parent_session_id`, `kind = 'follow_up'`), and
P1-28's `key`, `depth`, `prompt_tags` and `prompt_tag_links`, are built (migration `0010`) and now live in
the [current schema](current-schema.md). The archive columns (`archived_at`, `archived_by_user_id`,
`decline_reason`) are **not** in MVP-1 any more: archiving needs both partners to agree (Q4 overruled),
which is on the [roadmap](../../product/future-roadmap.md#mutual-archive). `prompt_skips` is unique per
`(user_id, prompt_id)`.

## Why follow-ups are child sessions

A follow-up has the same core rule as the main prompt: each partner answers independently, and nothing is
visible until both have submitted. Making it a `conversation_sessions` row with `parent_session_id` means
`session_responses`, `sessionViewerPhase`, `canViewerSeeAnswerText`, the mapper and the answering/waiting
components are all reused.

The differences for children are small and explicit:

1. **No reveal step** ([Q22](../03-product-decisions.md#q22)). Answers auto-show once both have submitted, so
   children never get `session_reveals` rows. Visibility checks "both submitted" when `parent_session_id`
   is set, and the viewer phase goes from `waiting_for_partner` straight to `revealed`.
2. **Hidden from the hub list.** `GET /sessions` returns top-level sessions only.
3. **Only created after both partners revealed the parent.**
4. **One level deep** ([E-12](design-review.md#e-12)).

*Rejected alternative:* separate `follow_up_responses` / `follow_up_reveals` tables. They're more explicit,
but they duplicate every hidden-answer rule and test.

## Session completion needs no column

[Q1](../03-product-decisions.md#q1) completion is derived: both partners have a `session_reveals` row on the
main session, and every started child session has both responses submitted (archiving comes back with the
mutual archive on the roadmap). Add `completed_at` only if completion later needs an explicit action or
becomes slow to compute.
