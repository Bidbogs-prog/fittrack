-- DR-012: invite codes didn't work for anyone who already had beta access
-- (accounts grandfathered by 20260817000000, or admitted via the waitlist):
-- redeem_invite returned 'already' before looking at the code, so its
-- premium days were never granted. Codes now grant premium to existing
-- users too, once per user per code.

create table if not exists public.invite_redemptions (
  user_id uuid not null references auth.users (id) on delete cascade,
  code text not null references public.invite_codes (code) on delete cascade,
  redeemed_at timestamptz not null default now(),
  primary key (user_id, code)
);

alter table public.invite_redemptions enable row level security;

drop policy if exists "invite redemptions: read own" on public.invite_redemptions;
create policy "invite redemptions: read own" on public.invite_redemptions
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "invite redemptions: admins read" on public.invite_redemptions;
create policy "invite redemptions: admins read" on public.invite_redemptions
  for select to authenticated
  using (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));

-- Backfill: codes already redeemed through the gate.
insert into public.invite_redemptions (user_id, code, redeemed_at)
select b.user_id, b.invite_code, b.granted_at
from public.beta_access b
join public.invite_codes c on c.code = b.invite_code
where b.invite_code is not null
on conflict do nothing;

-- Returns: 'ok' (access granted), 'premium' (existing user, premium days
-- granted), 'already' (existing user, nothing to add), 'invalid', 'expired',
-- 'full', 'used' (this user already redeemed this code), 'auth'.
create or replace function public.redeem_invite(p_code text, p_source jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_code public.invite_codes;
  v_has_access boolean;
begin
  if v_user is null then return 'auth'; end if;
  v_has_access := exists (select 1 from public.beta_access b where b.user_id = v_user);

  select * into v_code from public.invite_codes c where c.code = upper(trim(p_code)) for update;
  if not found then return case when v_has_access then 'already' else 'invalid' end; end if;
  if exists (select 1 from public.invite_redemptions r where r.user_id = v_user and r.code = v_code.code) then
    return 'used';
  end if;
  -- An existing user gains nothing from a code without premium days: don't burn a use.
  if v_has_access and v_code.premium_days = 0 then return 'already'; end if;
  if v_code.expires_at is not null and v_code.expires_at < now() then return 'expired'; end if;
  if v_code.uses >= v_code.max_uses then return 'full'; end if;

  update public.invite_codes set uses = uses + 1 where code = v_code.code;
  insert into public.invite_redemptions (user_id, code) values (v_user, v_code.code);
  -- grant_beta_access keeps an existing beta_access row and never shortens premium.
  perform public.grant_beta_access(v_user, 'invite', v_code.code, p_source, v_code.premium_days);
  return case when v_has_access then 'premium' else 'ok' end;
end;
$$;

revoke all on function public.redeem_invite(text, jsonb) from public, anon;
grant execute on function public.redeem_invite(text, jsonb) to authenticated;
