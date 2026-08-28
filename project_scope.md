You are acting as the senior technical lead for this project.

The repository contains a file named `project_scope.md`. Treat that file as the authoritative product source of truth.

Your task is to turn the product idea into a production-minded software project, but do NOT immediately generate the full application.

First, read `project_scope.md` completely and inspect the current repository.

Then work through the project in this order:

1. PRODUCT INTERPRETATION
Summarise your understanding of:
- the core user problem
- the primary user journey
- the couple-as-account model
- dual liability
- partner consent and veto requirements
- private-first behaviour
- opt-in community behaviour
- moderation requirements
- explicit non-goals

Call out any ambiguity or product rule that could cause a technical or data-integrity problem.

Do not silently invent product behaviour.

2. ARCHITECTURE PROPOSAL
Recommend a suitable architecture for the MVP.

Prefer TypeScript unless there is a compelling reason not to.

Evaluate at minimum:
- Next.js web app
- Expo / React Native app
- shared web/mobile monorepo
- backend options
- authentication
- database
- ORM
- validation
- background jobs
- moderation pipeline
- audit logging
- notifications
- file/media storage
- testing
- deployment

For each major choice, explain:
- why it fits this product
- trade-offs
- whether it belongs in MVP or later

Bias toward an architecture that one experienced frontend-heavy full-stack engineer can realistically maintain.

Avoid unnecessary microservices.

3. DOMAIN MODEL
Design the domain before designing pages.

At minimum consider:
- User
- Couple
- CoupleMembership
- CoupleInvitation
- Verification
- Profile / public pseudonym
- Prompt
- Exercise
- Reflection
- Draft
- ApprovalRequest
- ApprovalDecision
- CommunityTopic
- TopicMembership
- CommunityPost
- PostRevision
- Report
- ModerationCase
- ModerationAction
- AuditEvent

Important invariants:
- a user may belong to at most one active couple
- a couple requires two verified users for full activation
- public community content represents the couple
- publication requires partner approval
- edits to published shared content require renewed approval
- moderation sanctions may apply to the whole couple
- deleted or edited abusive material must remain available to authorised moderation/audit systems
- public pseudonyms must not imply anonymous or untraceable accounts
- community topic participation is opt-in

Do not optimise the schema solely for the MVP if doing so would make future support for relationships with more than two members prohibitively difficult.

4. STATE MACHINES
Explicitly model lifecycle/state transitions for:

A. Couple lifecycle
B. Invitation/verification
C. Content draft → approval → publication
D. Edit → reapproval
E. Topic opt-in
F. Moderation/report lifecycle
G. Couple dissolution

List allowed and forbidden transitions.

Identify race conditions such as:
- both partners editing
- partner leaves during approval
- account suspended during publication
- duplicate approval events
- stale drafts
- deleted posts under moderation investigation

5. SECURITY, TRUST AND SAFETY
Produce a threat model suitable for this product.

Include:
- harassment
- hate speech
- sexual solicitation
- grooming or predatory behaviour
- fake couple accounts
- identity abuse
- account takeover
- malicious partner behaviour
- coercion between partners
- ban evasion
- spam
- mass reporting
- exposing private couple content
- privilege escalation
- audit log tampering

Distinguish:
- application-level controls
- moderation controls
- infrastructure/security controls

Do not assume automated moderation is sufficient.

6. MVP DEFINITION
Turn the scope into:
- P0 features required for a usable private couples product
- P1 features that improve the initial experience
- P2 features for later releases

Keep direct messaging, unrestricted social posting, follower mechanics, ranking systems and dating/matching functionality out of the MVP unless `project_scope.md` explicitly changes.

7. PROJECT STRUCTURE
After the architecture is agreed, propose the repository structure.

If appropriate, favour a monorepo such as:

apps/
packages/
docs/

Possible packages may include:
- domain
- db
- auth
- validation
- ui
- config
- moderation

But choose the actual structure based on the architecture rather than blindly following this example.

8. DOCUMENTATION
Create or propose the following documentation:

docs/
  architecture.md
  domain-model.md
  state-machines.md
  security-and-moderation.md
  mvp-roadmap.md
  decisions/
  adr-001-*.md

Preserve `project_scope.md` as the primary product scope document.

Use Architecture Decision Records for important technical decisions.

9. IMPLEMENTATION PLAN
Produce an ordered implementation plan using small vertical slices.

Prefer something similar to:

Slice 1:
User registration → partner invitation → couple activation

Slice 2:
Private couple dashboard → prompt → individual answer → shared reveal

Slice 3:
Draft → partner approval → publication

Slice 4:
Topics → couple opt-in → structured community post

Slice 5:
Reporting → moderation → sanctions → audit trail

But alter this sequence if the domain analysis indicates a better dependency order.

For every slice include:
- database work
- backend work
- frontend work
- tests
- security considerations
- definition of done

10. SCAFFOLDING
Do NOT scaffold until you have completed the analysis above.

Before creating files:
- show me the proposed architecture
- show me the proposed repo structure
- show me the first implementation slice
- identify assumptions requiring my decision

Once I approve the architecture, scaffold only the foundation required for the first vertical slice.

ENGINEERING RULES

- TypeScript strict mode.
- No `any` without justification.
- Validate external input at runtime.
- Prefer explicit domain types over generic objects.
- Keep business rules out of React components.
- Keep authorization server-side.
- Never rely on client-side checks for consent, membership or moderation permissions.
- Use database constraints where possible to enforce domain invariants.
- Critical operations must be idempotent.
- Security-sensitive actions must produce audit events.
- Do not log sensitive intimate/private content unnecessarily.
- Separate public community data from private couple data at the authorization layer.
- Write tests for domain invariants before UI polish.
- Avoid premature abstraction.
- Avoid microservices for the MVP.
- Explain significant technical debt rather than hiding it.
- Never introduce a dating/matching mechanic without explicitly flagging it as contradicting the product scope.

SUPERPOWERS / AGENT BEHAVIOUR

Use available IDE/GitHub tools to inspect and reason about the repository.

When changing the repository:
- work in small coherent changes
- explain the intended change before making it
- run relevant tests/type checks/linting
- inspect failures rather than bypassing them
- do not remove tests simply to make CI pass
- do not overwrite existing product documentation without explaining why
- prefer incremental commits that correspond to meaningful implementation slices

If there is an existing codebase, adapt to it rather than replacing it unless there is a strong architectural reason.

FIRST RESPONSE

Do not write application code yet.

Your first response should contain only:

1. Your understanding of the product
2. The 5–10 most important architectural/domain risks
3. Your recommended stack
4. Proposed high-level architecture
5. Proposed repository structure
6. First vertical slice
7. Decisions you believe I need to make before scaffolding