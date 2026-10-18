# ERD · MVP-1 additions

[← Plan index](../README.md) · Builds on: [current schema](current-schema.md) · Tasks: [Phase 1](../tasks/phase-1-mvp-1.md), [Housekeeping](../tasks/housekeeping.md)

Only new or changed parts are shown. 🆕 = new table, ✏️ = new column on an existing table.

```mermaid
erDiagram
    prompts ||--o{ prompts : "parent_prompt_id (follow-ups)"
    conversation_sessions ||--o{ conversation_sessions : "parent_session_id (follow-up sessions)"
    users ||--o{ password_reset_tokens : "owns"
    users ||--o{ conversation_sessions : "archived_by"

    prompts {
        uuid parent_prompt_id FK "✏️ null for top-level prompts"
        text kind "✏️ curated | follow_up"
    }
    conversation_sessions {
        uuid parent_session_id FK "✏️ null for top-level; max depth 1 (E-12)"
        timestamptz archived_at "✏️ Q4"
        uuid archived_by_user_id FK "✏️"
        text decline_reason "✏️ preset enum, Q3"
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
main session, and every non-archived child session has both responses submitted. Add `completed_at` only
if completion later needs an explicit action or becomes slow to compute.
