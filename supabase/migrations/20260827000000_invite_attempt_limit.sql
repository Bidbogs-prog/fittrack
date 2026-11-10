-- Security audit #7: redeem_invite had no attempt limit, so readable codes
-- (e.g. FAMILY) could be found by trial and error. Unknown codes are now
-- recorded per user; after 10 misses in an hour, redeem returns 'rate'.

create table if not exists public.invite_attempts (
  user_id uuid not null references auth.users (id) on delete cascade,
  attempted_at timestamptz not null default now()
);

create index if not exists invite_attempts_user_idx on public.invite_attempts (user_id, attempted_at desc);

-- No policies: written and read only inside redeem_invite (security definer).
alter table public.invite_attempts enable row level security;

-- Returns: 'ok', 'premium', 'already', 'invalid', 'expired', 'full', 'used',
-- 'auth', or 'rate' (too many unknown codes recently).
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
  if (select count(*) from public.invite_attempts a
      where a.user_id = v_user and a.attempted_at > now() - interval '1 hour') >= 10 then
    return 'rate';
  end if;
  v_has_access := exists (select 1 from public.beta_access b where b.user_id = v_user);

  select * into v_code from public.invite_codes c where c.code = upper(trim(p_code)) for update;
  if not found then
    insert into public.invite_attempts (user_id) values (v_user);
    return case when v_has_access then 'already' else 'invalid' end;
  end if;
  if exists (select 1 from public.invite_redemptions r where r.user_id = v_user and r.code = v_code.code) then
    return 'used';
  end if;
  if v_has_access and v_code.premium_days = 0 then return 'already'; end if;
  if v_code.expires_at is not null and v_code.expires_at < now() then return 'expired'; end if;
  if v_code.uses >= v_code.max_uses then return 'full'; end if;

  update public.invite_codes set uses = uses + 1 where code = v_code.code;
  insert into public.invite_redemptions (user_id, code) values (v_user, v_code.code);
  perform public.grant_beta_access(v_user, 'invite', v_code.code, p_source, v_code.premium_days);
  return case when v_has_access then 'premium' else 'ok' end;
end;
$$;

revoke all on function public.redeem_invite(text, jsonb) from public, anon;
grant execute on function public.redeem_invite(text, jsonb) to authenticated;
