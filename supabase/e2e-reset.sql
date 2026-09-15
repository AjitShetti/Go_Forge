-- Resets the automated-test user's learning history so scripts/verify-p2-persistence.mjs
-- can run again. Run in the SQL editor (it bypasses RLS). Touches ONLY e2e@goforge.test.
delete from public.lesson_events where user_id = (select id from auth.users where email = 'e2e@goforge.test');
delete from public.lesson_progress where user_id = (select id from auth.users where email = 'e2e@goforge.test');
delete from public.predictions where user_id = (select id from auth.users where email = 'e2e@goforge.test');
delete from public.runs where user_id = (select id from auth.users where email = 'e2e@goforge.test');
delete from public.challenge_attempts where user_id = (select id from auth.users where email = 'e2e@goforge.test');
delete from public.notebook where user_id = (select id from auth.users where email = 'e2e@goforge.test');
