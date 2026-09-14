# Supabase setup (free tier, no Docker)

The app runs without Supabase. It shows a red **DB NOT CONNECTED** badge and saves nothing. To connect it:

1. **Create a project** at supabase.com on the **Free** plan. Don't enable compute add-ons, branching, PITR or custom domains; those are what cost money.
2. **Apply the schema.** In the SQL Editor, run the contents of `supabase/migrations/20260915000000_init.sql`, then `supabase/seed.sql`. The seed is idempotent, so re-run it whenever `content/go/track.json` changes (`npm run db:seed:gen` regenerates it).
3. **Configure auth.** Go to Authentication → URL Configuration:
   - Site URL: `http://localhost:3000`
   - Redirect URLs: add `http://localhost:3000/auth/callback`

   Email magic links use Supabase's built-in mailer, which is rate-limited on the free tier (a few emails per hour). That's fine for one user.
4. **Set keys.** Put these in `.env.local` (gitignored), then restart `npm run dev`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   # or the legacy anon key via NEXT_PUBLIC_SUPABASE_ANON_KEY
   ```
   No service-role key is needed by the app.

## What is verified locally vs. not

- **Verified locally:** migration and seed apply cleanly, and all RLS policies behave as intended. This runs on real Postgres via PGlite with a Supabase-shaped auth shim (`tests/db/`, `npm test`). The tests were mutation-checked: loosening a policy or dropping RLS on a table makes them fail.
- **Not verified yet:** the magic-link round trip against a live Supabase project, and the proxy's session refresh. Nothing in this session could reach a Supabase project.
