-- Conversational AI coach (roadmap 1.6 A): chat conversations + messages,
-- own rows only. `summary` on the conversation is a rolling model-written
-- recap of older turns so long chats don't grow the prompt unbounded;
-- `payload` on a message stores guardrail flags for that turn (never
-- message content duplicated elsewhere).

create table if not exists public.coach_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  title text,
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists coach_conversations_user_idx
  on public.coach_conversations (user_id, updated_at desc);

alter table public.coach_conversations enable row level security;

drop policy if exists "coach conversations: read own" on public.coach_conversations;
create policy "coach conversations: read own" on public.coach_conversations
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "coach conversations: insert own" on public.coach_conversations;
create policy "coach conversations: insert own" on public.coach_conversations
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "coach conversations: update own" on public.coach_conversations;
create policy "coach conversations: update own" on public.coach_conversations
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "coach conversations: delete own" on public.coach_conversations;
create policy "coach conversations: delete own" on public.coach_conversations
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.coach_conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) <= 8000),
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists coach_messages_conversation_idx
  on public.coach_messages (conversation_id, created_at);

alter table public.coach_messages enable row level security;

drop policy if exists "coach messages: own via conversation" on public.coach_messages;
create policy "coach messages: own via conversation" on public.coach_messages
  for all to authenticated
  using (exists (
    select 1 from public.coach_conversations c
    where c.id = conversation_id and c.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.coach_conversations c
    where c.id = conversation_id and c.user_id = (select auth.uid())
  ));
