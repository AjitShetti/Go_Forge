-- P4: which question a prediction answered.
--   'trap'           the lesson's Provoke program (the default, so P2's inserts are unchanged)
--   'review:<card>'  a review card, <card> = '<content_ref>#<block id>'
-- Mastery needs this: a concept is mastered only after a correct first try on
-- a *different* question than the one first predicted (spec §4).
alter table public.predictions
  add column source text not null default 'trap'
  check (source = 'trap' or source ~ '^review:go/[a-z0-9-]+/[a-z0-9-]+#[a-z0-9-]+$');

create index predictions_user_source on public.predictions (user_id, source);
