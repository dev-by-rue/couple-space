# Welcoming couple-space prototype

## Build
- Replace the placeholder home page with invite-pending and active couple-home states, including first-visit welcome, conversation list, invite actions, and disabled settings.
- Add `/start` with curated theme/prompt selection and custom prompt composition.
- Add `/conversation/$id` with private response, confirmation, waiting, mutual reveal, curated follow-ups, and directed question flows.
- Add a development-only prototype control panel for switching member, couple status, conversation state, and follow-up states.

## Data and behavior
- Create typed couple, member, prompt, response, session, follow-up, and directed-question models under `src/types/`.
- Create a local mock repository and React state provider under `src/mocks/`; preserve any available real email and invite-status inputs through the repository boundary.
- Add the required custom-prompt product flag and mark unresolved behavior with the requested `OPEN QUESTION` and `TODO(product)` comments.
- Enforce soft-lock behavior so no answer content or response detail appears before mutual submission.

## Presentation and quality
- Define a warm neutral, dusty-rose, and cool waiting-state design system with dark-mode tokens, serif headings, sans body text, visible focus states, and reduced-motion fallbacks.
- Build reusable cards, status, reveal, waiting, composer, invite, and controls components with mobile-first layouts.
- Add route-specific metadata, matching loading skeletons, empty states, and error states.
- Verify the main routes and prototype state transitions at mobile and desktop sizes.

## Scope guardrails
- Do not alter authentication, registration, invitations, or database structure.
- Do not add messaging, archives, browsing, journaling, community features, identity checks, gamification, notifications, completion states, or dissolution flows.
