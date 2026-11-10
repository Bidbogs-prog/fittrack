-- Security audit #1: users could insert their own ai_usage rows with any
-- cost_usd, so one forged row tripped the global daily spend cap and turned
-- AI off for everyone; ai_spend_today() also exposed platform-wide spend.
-- Usage is now written by the server with the service role only.

drop policy if exists "ai usage: insert own" on public.ai_usage;

revoke execute on function public.ai_spend_today() from authenticated;
grant execute on function public.ai_spend_today() to service_role;
