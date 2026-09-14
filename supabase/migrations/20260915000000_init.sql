-- Go Forge initial schema.
-- RLS is enabled on every table. User tables: a user reads/writes only their
-- own rows. Content tables (tracks, modules, lessons, concepts,
-- lesson_concepts, scenarios): read-only to clients, written only by the seed
-- (service role / SQL editor).
--
-- Changes from the spec's §7 sketch, each for a stated reason:
--   predictions.concept_id      a lesson touches several concepts; the ledger needs the trap's tag
--   runs.step, runs.status      distinguish provoke/rebuild/challenge runs; timeouts vs exits
--   challenge_attempts.solution_revealed, duration_ms   mastery rule + "duration" from §4
--   mastery PK + ease/interval_days/error_count         SM-2 scheduling needs them
--   notebook.kind               stretch submissions vs free notes
--   designs.design_key          groups versions of one design for history/diff
--   design_reviews.warnings     report has violations and warnings
--   lesson_progress, lesson_events   §4 "persist every transition"

-- ---------------------------------------------------------------- content ---

create table public.tracks (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  "order" int not null
);

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references public.tracks (id) on delete cascade,
  slug text not null,
  code text not null,
  title text not null,
  "order" int not null,
  unique (track_id, slug)
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules (id) on delete cascade,
  slug text not null,
  title text not null,
  "order" int not null,
  requires text[] not null default '{}',
  content_ref text not null,
  unique (module_id, slug),
  unique (content_ref)
);

create table public.concepts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null
);

create table public.lesson_concepts (
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  concept_id uuid not null references public.concepts (id) on delete cascade,
  primary key (lesson_id, concept_id)
);

create table public.scenarios (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  requirements jsonb not null default '{}',
  constraints jsonb not null default '[]',
  rules jsonb not null default '[]'
);

-- ------------------------------------------------------------------- users ---

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

create table public.predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  concept_id uuid references public.concepts (id) on delete set null,
  text text not null,
  correct boolean not null,
  created_at timestamptz not null default now()
);
create index predictions_user_concept on public.predictions (user_id, concept_id, created_at desc);

create table public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lesson_id uuid references public.lessons (id) on delete cascade,
  step text not null check (step in ('collide', 'rebuild', 'challenge', 'stretch', 'free')),
  code text not null,
  stdout text not null default '',
  stderr text not null default '',
  exit_code int,
  status text not null,
  ms int,
  created_at timestamptz not null default now()
);
create index runs_user_lesson on public.runs (user_id, lesson_id, created_at desc);

create table public.challenge_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  code text not null,
  passed boolean not null,
  failed_cases jsonb not null default '[]',
  hints_used int not null default 0 check (hints_used between 0 and 2),
  solution_revealed boolean not null default false,
  duration_ms int,
  created_at timestamptz not null default now()
);
create index challenge_attempts_user_lesson on public.challenge_attempts (user_id, lesson_id, created_at desc);

create table public.mastery (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  concept_id uuid not null references public.concepts (id) on delete cascade,
  state text not null default 'new' check (state in ('new', 'learning', 'review', 'mastered')),
  streak int not null default 0,
  ease numeric(4, 2) not null default 2.5,
  interval_days int not null default 0,
  error_count int not null default 0,
  last_seen timestamptz,
  next_review timestamptz,
  primary key (user_id, concept_id)
);

create table public.notebook (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lesson_id uuid references public.lessons (id) on delete set null,
  kind text not null default 'note' check (kind in ('stretch', 'note')),
  body text not null,
  created_at timestamptz not null default now()
);

create table public.lesson_progress (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  state text not null,
  completed boolean not null default false,
  marked_for_review boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table public.lesson_events (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  from_state text not null,
  to_state text not null,
  event text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index lesson_events_user_lesson on public.lesson_events (user_id, lesson_id, id);

create table public.designs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  design_key uuid not null default gen_random_uuid(),
  scenario_id uuid references public.scenarios (id) on delete set null,
  name text not null default 'Untitled design',
  graph jsonb not null,
  version int not null check (version >= 1),
  created_at timestamptz not null default now(),
  unique (design_key, version)
);

create table public.design_reviews (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null references public.designs (id) on delete cascade,
  score int not null,
  violations jsonb not null default '[]',
  warnings jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------ profile on signup ---

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --------------------------------------------------------------------- RLS ---

alter table public.tracks enable row level security;
alter table public.modules enable row level security;
alter table public.lessons enable row level security;
alter table public.concepts enable row level security;
alter table public.lesson_concepts enable row level security;
alter table public.scenarios enable row level security;
alter table public.profiles enable row level security;
alter table public.predictions enable row level security;
alter table public.runs enable row level security;
alter table public.challenge_attempts enable row level security;
alter table public.mastery enable row level security;
alter table public.notebook enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.lesson_events enable row level security;
alter table public.designs enable row level security;
alter table public.design_reviews enable row level security;

-- Content: anyone may read; no insert/update/delete policies exist, so clients cannot write.
create policy "content readable" on public.tracks for select to anon, authenticated using (true);
create policy "content readable" on public.modules for select to anon, authenticated using (true);
create policy "content readable" on public.lessons for select to anon, authenticated using (true);
create policy "content readable" on public.concepts for select to anon, authenticated using (true);
create policy "content readable" on public.lesson_concepts for select to anon, authenticated using (true);
create policy "content readable" on public.scenarios for select to anon, authenticated using (true);

create policy "own profile" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "own profile update" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Learning records are append-only history: select + insert, no update/delete.
create policy "own rows read" on public.predictions for select to authenticated using (user_id = (select auth.uid()));
create policy "own rows insert" on public.predictions for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own rows read" on public.runs for select to authenticated using (user_id = (select auth.uid()));
create policy "own rows insert" on public.runs for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own rows read" on public.challenge_attempts for select to authenticated using (user_id = (select auth.uid()));
create policy "own rows insert" on public.challenge_attempts for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own rows read" on public.lesson_events for select to authenticated using (user_id = (select auth.uid()));
create policy "own rows insert" on public.lesson_events for insert to authenticated with check (user_id = (select auth.uid()));

-- Mutable per-user state.
create policy "own rows read" on public.mastery for select to authenticated using (user_id = (select auth.uid()));
create policy "own rows insert" on public.mastery for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own rows update" on public.mastery for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own rows read" on public.lesson_progress for select to authenticated using (user_id = (select auth.uid()));
create policy "own rows insert" on public.lesson_progress for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own rows update" on public.lesson_progress for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own rows read" on public.notebook for select to authenticated using (user_id = (select auth.uid()));
create policy "own rows insert" on public.notebook for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own rows update" on public.notebook for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows delete" on public.notebook for delete to authenticated using (user_id = (select auth.uid()));

-- Design versions are immutable: a new version is a new row.
create policy "own rows read" on public.designs for select to authenticated using (user_id = (select auth.uid()));
create policy "own rows insert" on public.designs for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own rows delete" on public.designs for delete to authenticated using (user_id = (select auth.uid()));

-- Reviews belong to whoever owns the design.
create policy "own design reviews read" on public.design_reviews for select to authenticated
  using (exists (select 1 from public.designs d where d.id = design_id and d.user_id = (select auth.uid())));
create policy "own design reviews insert" on public.design_reviews for insert to authenticated
  with check (exists (select 1 from public.designs d where d.id = design_id and d.user_id = (select auth.uid())));

-- ------------------------------------------------------------------ grants ---
-- Supabase grants broad table privileges to anon/authenticated by default;
-- RLS above is what actually restricts access. Tighten anyway.
revoke all on all tables in schema public from anon;
grant select on public.tracks, public.modules, public.lessons, public.concepts, public.lesson_concepts, public.scenarios to anon;
