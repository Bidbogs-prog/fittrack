-- AUD-10: rolling summary watermark. Messages after summary_through are sent
-- verbatim; older ones are in summary. Null = nothing summarised yet.
alter table public.coach_conversations
  add column if not exists summary_through timestamptz;
