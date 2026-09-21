-- Curated catalog seed for walking skeleton (/start).
-- Idempotent: skips if the everyday theme already exists.
-- Run: pnpm --filter @couple-space/database seed

INSERT INTO prompt_themes (id, title, description, symbol, sort_order)
SELECT
  'a0000000-0000-4000-8000-000000000001'::uuid,
  'Everyday moments',
  'Notice the small things that shape your days.',
  '☕',
  0
WHERE NOT EXISTS (
  SELECT 1 FROM prompt_themes WHERE id = 'a0000000-0000-4000-8000-000000000001'::uuid
);

INSERT INTO prompts (id, theme_id, title, description, text, kind, sort_order)
SELECT
  'a0000000-0000-4000-8000-000000000011'::uuid,
  'a0000000-0000-4000-8000-000000000001'::uuid,
  'Everyday moments',
  'A quiet question to answer in your own words.',
  'What small moment with me has stayed with you this week?',
  'curated',
  0
WHERE NOT EXISTS (
  SELECT 1 FROM prompts WHERE id = 'a0000000-0000-4000-8000-000000000011'::uuid
);

INSERT INTO prompts (id, theme_id, title, description, text, kind, sort_order)
SELECT
  'a0000000-0000-4000-8000-000000000012'::uuid,
  'a0000000-0000-4000-8000-000000000001'::uuid,
  'Everyday moments · 2',
  'A quiet question to answer in your own words.',
  'When do you feel most at ease in our everyday life?',
  'curated',
  1
WHERE NOT EXISTS (
  SELECT 1 FROM prompts WHERE id = 'a0000000-0000-4000-8000-000000000012'::uuid
);
