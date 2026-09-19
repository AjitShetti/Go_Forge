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

Sign-in is passwordless: an email with a link **and** a one-time code, plus GitHub when it's switched on.

- **Links use `token_hash`, not PKCE.** A PKCE `?code=` link only works in the browser that asked for it. On phones, email apps open links in their own browser, so those links failed with "PKCE code verifier not found". The email templates send `/auth/callback?token_hash=…&type=email` instead, which works anywhere. The callback still accepts `?code=` for GitHub sign-in.
- **The code** (`{{ .Token }}`) can be typed on the sign-in page. It covers opening the email on a different device.
- **Email volume.** Supabase's built-in mailer allows **2 emails per hour for the whole project**. That isn't enough for a public site, so Auth uses custom SMTP (free: Gmail with an app password, about 500 a day, or Brevo, 300 a day).
- **GitHub sign-in** needs no email at all. The button appears on `/login` only once the provider is enabled (the page reads `/auth/v1/settings`). GitHub OAuth app callback URL: `https://qevyjanefkagxnxxbvns.supabase.co/auth/v1/callback`.
- Errors shown to people go through `src/lib/auth/auth-errors.ts`, never Supabase's raw text.

All of this is applied by `scripts/configure-auth.mjs` (Site URL, redirect allow-list, templates, and SMTP / GitHub when their env vars are set). It needs a personal access token and dry-runs unless given `--apply`.

## Automated-test user

`e2e@goforge.test` is a password user created with SQL, used only by `scripts/verify-p2-persistence.mjs`. Automated tests can't click magic links.

- Its password lives only in `.env.local`.
- To re-run the persistence check, first run `supabase/e2e-reset.sql` in the SQL editor. That file deletes only this user's learning rows.
- Delete the user from Authentication → Users whenever you like.

## Changing the schema

1. Add a new file under `supabase/migrations/` and run `npm test`. The RLS tests apply every migration to PGlite.
2. Apply the migration to the project with the SQL editor or the Supabase MCP.
3. If `content/go/track.json` changed, run `npm run db:seed:gen` and apply `supabase/seed.sql`. The seed is idempotent.
