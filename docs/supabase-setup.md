# Supabase

## The live project

| | |
|---|---|
| Project | `go-forge` (ref `qevyjanefkagxnxxbvns`) |
| Organization | AjitShetti's Org, **Free** plan |
| Region | ap-south-1 |
| Cost | $0/month, confirmed via the Supabase cost API before creation |

Applied:

- `supabase/migrations/20260915000000_init.sql`
- `supabase/migrations/20260915000100_lock_trigger_function.sql`
- `supabase/seed.sql`, which loads 13 modules, 43 lessons, 52 concepts and 57 lesson–concept links

The security advisor was clean after the second migration. The performance advisor only reports INFO-level notes: unindexed foreign keys and unused indexes on empty tables. Neither matters at single-user scale.

`.env.local` (gitignored) holds `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. The app never uses a service-role key.

To stay free: don't enable compute add-ons, branching, PITR or custom domains. Free projects pause after about a week of inactivity; restore them from the dashboard.

## Auth

- Magic link via Supabase's built-in mailer.
- On the free tier it only delivers to members of the organization's team, a few emails per hour. That's fine for a single user signing in with their own address.
- Callback: `/auth/callback`. It handles both `?code=` (PKCE) and `?token_hash=&type=`.
- In the dashboard, check that Authentication → URL Configuration has Site URL `http://localhost:3000` and an allowed redirect `http://localhost:3000/auth/callback`. Add the Vercel URL at P8.

## Automated-test user

`e2e@goforge.test` is a password user created with SQL, used only by `scripts/verify-p2-persistence.mjs`. Automated tests can't click magic links.

- Its password lives only in `.env.local`.
- To re-run the persistence check, first run `supabase/e2e-reset.sql` in the SQL editor. That file deletes only this user's learning rows.
- Delete the user from Authentication → Users whenever you like.

## Changing the schema

1. Add a new file under `supabase/migrations/` and run `npm test`. The RLS tests apply every migration to PGlite.
2. Apply the migration to the project with the SQL editor or the Supabase MCP.
3. If `content/go/track.json` changed, run `npm run db:seed:gen` and apply `supabase/seed.sql`. The seed is idempotent.
