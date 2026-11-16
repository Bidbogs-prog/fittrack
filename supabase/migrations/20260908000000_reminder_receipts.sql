-- Delivery receipts for reminders. "sent" only meant FCM accepted the
-- push; the phone's service worker now reports when it received and showed
-- it, so a missing reminder can be told apart from a phone that held it.
alter table public.reminder_log
  add column if not exists received_at timestamptz,
  add column if not exists shown boolean;

-- Called by /api/push/ack with the device's push endpoint (its proof of
-- possession). Only an existing log row of that device's owner is touched,
-- once. Service role only.
create or replace function public.ack_reminder(p_endpoint text, p_slot text, p_date date, p_shown boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  owner uuid;
  n integer;
begin
  select user_id into owner from public.push_subscriptions where endpoint = p_endpoint;
  if owner is null then
    return false;
  end if;
  update public.reminder_log
  set received_at = coalesce(received_at, now()), shown = coalesce(shown, false) or p_shown
  where user_id = owner and slot = p_slot and local_date = p_date;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

revoke all on function public.ack_reminder(text, text, date, boolean) from public, anon, authenticated;
grant execute on function public.ack_reminder(text, text, date, boolean) to service_role;
