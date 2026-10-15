# ERD · Current schema

[← Plan index](../README.md) · As of migration `0005` (`packages/database/src/schema`) · Next: [MVP-1 additions](mvp-1.md)

```mermaid
erDiagram
    users ||--o{ couple_memberships : "has"
    couples ||--o{ couple_memberships : "has"
    couples ||--o{ couple_invitations : "issues"
    users ||--o{ couple_invitations : "invited_by"
    users ||--o{ refresh_tokens : "owns"
    users ||--o{ email_verification_tokens : "owns"
    prompt_themes ||--o{ prompts : "groups"
    couples ||--o{ conversation_sessions : "has"
    prompts ||--o{ conversation_sessions : "used by"
    conversation_sessions ||--o{ session_responses : "has (one per member)"
    users ||--o{ session_responses : "writes"
    conversation_sessions ||--o{ session_reveals : "has (one per member)"
    users ||--o{ session_reveals : "reveals"
    users |o--o{ audit_events : "actor (no FK)"

    users {
        uuid id PK "also JWT sub"
        text email UK
        text password_hash "argon2id"
        boolean email_verified
        text display_name
        date date_of_birth
        timestamptz created_at
        timestamptz updated_at
    }
    couples {
        uuid id PK
        text status "forming|active|dissolving|dissolved"
        timestamptz created_at
        timestamptz updated_at
    }
    couple_memberships {
        uuid id PK
        uuid couple_id FK
        uuid user_id FK "unique WHERE status=active"
        text status "active|left"
        timestamptz created_at
    }
    couple_invitations {
        uuid id PK
        uuid couple_id FK
        uuid invited_by_user_id FK
        text email
        text token UK
        text status "pending|accepted|revoked|expired"
        timestamptz expires_at
        timestamptz accepted_at
        timestamptz created_at
    }
    refresh_tokens {
        uuid id PK
        uuid user_id FK "nullable (H-2)"
        text token_hash
        timestamp expires_at "no tz (H-2)"
        timestamptz revoked_at
        timestamptz created_at
    }
    email_verification_tokens {
        uuid id PK
        uuid user_id FK
        text token_hash UK
        timestamptz expires_at
        timestamptz used_at
        timestamptz created_at
    }
    audit_events {
        uuid id PK
        uuid actor_user_id "no FK"
        text action
        text entity_type
        text entity_id
        jsonb metadata
        timestamptz created_at
    }
    prompt_themes {
        uuid id PK
        text slug UK
        text title
        text description
        text symbol "lucide key"
        int sort_order
    }
    prompts {
        uuid id PK
        uuid theme_id FK
        text title
        text description
        text text
        text kind "curated"
        int sort_order
    }
    conversation_sessions {
        uuid id PK
        uuid couple_id FK
        uuid prompt_id FK
        timestamptz created_at
        timestamptz updated_at
    }
    session_responses {
        uuid id PK
        uuid session_id FK "unique (session_id, user_id)"
        uuid user_id FK
        text body "draft until submitted_at set"
        timestamptz submitted_at "null = not submitted"
        timestamptz created_at
        timestamptz updated_at
    }
    session_reveals {
        uuid id PK
        uuid session_id FK "unique (session_id, user_id)"
        uuid user_id FK
        timestamptz revealed_at
    }
```

## What's already good

- Membership rows instead of `partner_a`/`partner_b` columns, so multi-partner support stays possible.
- Per-user reveal rows, which match the product rule exactly.
- One response row per member, created up front ([E-5](design-review.md#e-5) covers the trade-off).
- Tokens stored as hashes.
- An audit table from day one.

Known issues are listed in the [design review](design-review.md).
