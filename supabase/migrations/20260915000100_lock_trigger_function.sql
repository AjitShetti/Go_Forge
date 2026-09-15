-- handle_new_user is a trigger function only. Supabase exposes public functions
-- over /rest/v1/rpc, so revoke direct execution (flagged by the security advisor,
-- lints 0028/0029). The trigger still fires: triggers don't need EXECUTE for the caller.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
