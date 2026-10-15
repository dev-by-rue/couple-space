# ERD · MVP-2 additions

[← Plan index](../README.md) · Builds on: [MVP-1](mvp-1.md) · Tasks: [Phase 2](../tasks/phase-2-couple-created.md)

Only new or changed parts are shown. 🆕 = new table, ✏️ = new column on an existing table.

```mermaid
erDiagram
    couples ||--o{ prompts : "couple_id (custom prompts)"
    users ||--o{ prompts : "author_user_id"
    couples ||--o{ prompt_proposals : "has"
    users ||--o{ prompt_proposals : "proposed_by / decided_by"
    prompt_proposals |o--o| prompts : "becomes (on accept)"
    couples ||--o{ saved_prompts : "saves"
    prompts ||--o{ saved_prompts : "saved"

    prompts {
        uuid couple_id FK "✏️ null = platform prompt"
        uuid author_user_id FK "✏️ never sent to non-author pre-reveal"
        text kind "✏️ + custom | partner_question (Q21)"
    }
    prompt_proposals {
        uuid id PK "🆕"
        uuid couple_id FK
        uuid proposed_by_user_id FK
        text text
        text status "pending|accepted|discarded|expired"
        uuid decided_by_user_id FK
        timestamptz decided_at
        uuid prompt_id FK "set on accept"
        timestamptz created_at
    }
    saved_prompts {
        uuid couple_id PK, FK "🆕"
        uuid prompt_id PK, FK
        timestamptz created_at
    }
```

## Notes

- **Cap of 3 proposals:** `count(prompt_proposals WHERE proposed_by_user_id = me AND status = 'pending') < 3`.
  Enforce it in a domain function and check it inside the insert transaction.
- **Partner-added questions** ([Q21](../03-product-decisions.md#q21)) don't need a new table. They're
  `prompts` rows with `kind = 'partner_question'`, `couple_id` and `author_user_id` set, and `parent_prompt_id`
  pointing at the main prompt. They're answered in a child session that auto-shows answers
  ([Q22](../03-product-decisions.md#q22)). They skip `prompt_proposals`: the partner doesn't need to
  accept a follow-up question, only answer it, and skipping is allowed.
- **Attribution:** `author_user_id` is never sent to the non-author before both have revealed (P2-3). Partner-added
  questions are the exception: they're attributed from the start ([Q21](../03-product-decisions.md#q21)).
