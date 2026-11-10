-- Security audit #9a: joining the waitlist with an email already on it
-- returned that person's referral code and queue position, so anyone could
-- look them up (and use their referral link). Existing emails now get only
-- "already" — no code, no position.

create or replace function public.join_waitlist(
  p_email text,
  p_locale text,
  p_city text,
  p_phone_os text,
  p_health_app text,
  p_referred_by text,
  p_source jsonb
)
returns table (referral_code text, queue_position integer, already boolean)
language plpgsql
volatile
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_email text := lower(trim(p_email));
  v_row public.waitlist;
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then
    raise exception 'invalid_email';
  end if;

  if exists (select 1 from public.waitlist w where lower(w.email) = v_email) then
    return query select null::text, 0, true;
    return;
  end if;

  insert into public.waitlist (email, locale, city, phone_os, health_app, referral_code, referred_by, source)
  values (
    v_email,
    left(p_locale, 10),
    nullif(left(trim(p_city), 80), ''),
    case when p_phone_os in ('ios', 'android', 'other') then p_phone_os end,
    nullif(left(trim(p_health_app), 40), ''),
    upper(substr(md5(gen_random_uuid()::text), 1, 8)),
    case when exists (select 1 from public.waitlist r where r.referral_code = upper(p_referred_by))
      then upper(p_referred_by) end,
    case when pg_column_size(p_source) <= 2000 then p_source end
  )
  returning * into v_row;

  return query select v_row.referral_code, public.waitlist_position(v_row.id), false;
end;
$$;

revoke all on function public.join_waitlist(text, text, text, text, text, text, jsonb) from public;
grant execute on function public.join_waitlist(text, text, text, text, text, text, jsonb) to anon, authenticated;
