# ERD · MVP-3 sketch (community)

[← Plan index](../README.md) · Builds on: [MVP-2](mvp-2.md) · Tasks: [Phase 3](../tasks/phase-3-community.md)

This is shown only so the earlier phases don't block it. **Don't create these tables until
[P3-1](../tasks/phase-3-community.md) (the community spec) is written.**

```mermaid
erDiagram
    couples ||--o| community_profiles : "opts in"
    couples ||--o{ community_posts : "authors"
    community_posts ||--o{ post_approvals : "needs one per member"
    users ||--o{ post_approvals : "approves"
    conversation_sessions |o--o{ community_posts : "source (optional)"
    users ||--o{ reports : "files"
    reports }o--|| community_posts : "targets (polymorphic)"
    users ||--o{ moderation_actions : "moderator"
    couples ||--o{ moderation_actions : "subject"
    users ||--o{ user_roles : "has"

    community_profiles {
        uuid couple_id PK, FK
        text handle UK
        timestamptz opted_in_at
        timestamptz suspended_until
    }
    community_posts {
        uuid id PK
        uuid couple_id FK
        uuid source_session_id FK "nullable"
        text body
        int version "bump on edit → approvals reset"
        text status "draft|pending_approval|published|withdrawn|removed"
        timestamptz published_at
    }
    post_approvals {
        uuid post_id PK, FK
        uuid user_id PK, FK
        int version PK
        timestamptz approved_at
    }
    reports {
        uuid id PK
        uuid reporter_user_id FK
        text target_type
        uuid target_id
        text reason "preset"
        text status "open|actioned|dismissed"
        timestamptz created_at
    }
    moderation_actions {
        uuid id PK
        uuid moderator_user_id FK
        uuid report_id FK "nullable"
        uuid couple_id FK
        text action "hide|warn|suspend|ban"
        text reason
        timestamptz created_at
    }
    user_roles {
        uuid user_id PK, FK
        text role PK "moderator|admin"
    }
```

## What the current schema already does right for this

- The couple is a first-class row, so the public actor can be the couple ([E-11](design-review.md#e-11)).
- Membership rows make "every member approved" a simple count.
- `audit_events` can record every moderation action.
