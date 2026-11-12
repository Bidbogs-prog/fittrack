-- Offline replays (AUD-03/04): an idempotency key per queued entry, so a
-- replay after a lost response doesn't log the meal twice.
alter table public.diary_entries
  add column if not exists client_id text check (char_length(client_id) <= 80);

create unique index if not exists diary_entries_client_id_key
  on public.diary_entries (user_id, client_id) where client_id is not null;
