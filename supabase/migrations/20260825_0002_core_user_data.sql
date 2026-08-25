-- ONTRACK core cloud schema.
-- Every row is owned by auth.uid() and protected by RLS.

create extension if not exists pgcrypto;

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text,
  title text not null,
  category text not null default '',
  status text not null default 'active' check (status in ('active','on-hold','completed')),
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  cadence text not null default '',
  target_date date,
  notes text not null default '',
  cover_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, client_id)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  client_id text,
  title text not null,
  done boolean not null default false,
  completed_at timestamptz,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, client_id)
);

create table if not exists public.calendar_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid references public.goals(id) on delete set null,
  client_id text,
  title text not null,
  day_index integer,
  start_hour numeric,
  duration_hours numeric,
  planned_at timestamptz,
  done boolean not null default false,
  completed_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, client_id)
);

create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text,
  training_day text not null,
  week_number integer not null default 1,
  exercise_name text not null,
  exercise_group text not null default '',
  completed boolean not null default false,
  sets integer,
  reps integer,
  weight numeric,
  notes text not null default '',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, client_id)
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid references public.goals(id) on delete set null,
  client_id text,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  is_cover boolean not null default false,
  created_at timestamptz not null default now(),
  unique(user_id, client_id)
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists goals_user_updated_idx on public.goals(user_id, updated_at desc);
create index if not exists tasks_goal_position_idx on public.tasks(goal_id, position);
create index if not exists calendar_user_planned_idx on public.calendar_entries(user_id, planned_at);
create index if not exists activity_user_created_idx on public.activity_logs(user_id, created_at desc);
create index if not exists media_user_created_idx on public.media(user_id, created_at desc);

alter table public.goals enable row level security;
alter table public.tasks enable row level security;
alter table public.calendar_entries enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.activity_logs enable row level security;
alter table public.media enable row level security;
alter table public.user_settings enable row level security;

do $$
declare t text;
begin
  foreach t in array array['goals','tasks','calendar_entries','workout_sessions','activity_logs','media'] loop
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t || '_select_own', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t || '_insert_own', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t || '_update_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t || '_delete_own', t);
  end loop;
end $$;

create policy user_settings_select_own on public.user_settings for select to authenticated using ((select auth.uid()) = user_id);
create policy user_settings_insert_own on public.user_settings for insert to authenticated with check ((select auth.uid()) = user_id);
create policy user_settings_update_own on public.user_settings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy user_settings_delete_own on public.user_settings for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['goals','tasks','calendar_entries','workout_sessions','user_settings'] loop
    execute format('create trigger touch_updated_at before update on public.%I for each row execute procedure public.touch_updated_at()', t);
  end loop;
end $$;

insert into storage.buckets (id, name, public, file_size_limit)
values ('user-media', 'user-media', false, 104857600)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit;

create policy user_media_select_own on storage.objects
for select to authenticated
using (bucket_id = 'user-media' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy user_media_insert_own on storage.objects
for insert to authenticated
with check (bucket_id = 'user-media' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy user_media_update_own on storage.objects
for update to authenticated
using (bucket_id = 'user-media' and (storage.foldername(name))[1] = (select auth.uid()::text))
with check (bucket_id = 'user-media' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy user_media_delete_own on storage.objects
for delete to authenticated
using (bucket_id = 'user-media' and (storage.foldername(name))[1] = (select auth.uid()::text));
