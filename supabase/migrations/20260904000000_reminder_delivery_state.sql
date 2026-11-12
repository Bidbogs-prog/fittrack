-- AUD-06: a reminder slot is no longer consumed by the claim alone.
-- reminder_log rows move claimed -> sent | failed. A failed (or crashed,
-- still "claimed" after 5 minutes) slot is retried by later runs, at most
-- 3 attempts, while the send window is still open. "sent" means the push
-- service accepted it, not that the phone displayed it.
alter table public.reminder_log
  add column if not exists status text not null default 'sent' check (status in ('claimed', 'sent', 'failed')),
  add column if not exists attempts smallint not null default 1,
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.claim_reminder(p_user uuid, p_slot text, p_date date)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  ok boolean;
begin
  insert into public.reminder_log (user_id, slot, local_date, status, attempts, updated_at)
  values (p_user, p_slot, p_date, 'claimed', 1, now())
  on conflict (user_id, slot, local_date) do update
    set status = 'claimed', attempts = public.reminder_log.attempts + 1, updated_at = now()
    where public.reminder_log.attempts < 3
      and (
        (public.reminder_log.status = 'failed' and public.reminder_log.updated_at < now() - interval '4 minutes')
        or (public.reminder_log.status = 'claimed' and public.reminder_log.updated_at < now() - interval '5 minutes')
      )
  returning true into ok;
  return coalesce(ok, false);
end;
$$;

revoke all on function public.claim_reminder(uuid, text, date) from public, anon, authenticated;
grant execute on function public.claim_reminder(uuid, text, date) to service_role;
