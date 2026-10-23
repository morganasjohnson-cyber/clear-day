-- Run once in your Supabase project's SQL Editor. Safe to run again.
create table if not exists public.clear_day_plans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{"days":{}}'::jsonb,
  version integer not null default 1 check (version > 0),
  constraint clear_day_document check (jsonb_typeof(data) = 'object' and data ? 'days' and jsonb_typeof(data->'days') = 'object')
);
alter table public.clear_day_plans enable row level security;
revoke all on public.clear_day_plans from anon;
grant select, insert, update, delete on public.clear_day_plans to authenticated;
drop policy if exists "Only access your own plans" on public.clear_day_plans;
create policy "Only access your own plans" on public.clear_day_plans
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
