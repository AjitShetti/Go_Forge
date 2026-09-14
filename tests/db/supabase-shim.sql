-- Minimal stand-in for the parts of Supabase that migrations and RLS depend on,
-- so policies can be tested in PGlite (real Postgres compiled to wasm) without
-- Docker. Mirrors Supabase: roles anon/authenticated/service_role, auth.users,
-- auth.uid() reading request.jwt.claims, and Supabase's default grants (which
-- are broad; RLS must do the real work).
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create schema auth;
create table auth.users (
  id uuid primary key,
  email text
);

create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid
$$;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
