-- ONTRACK Sync V2: one account, one cloud state, every device.

alter table public.media
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists goal_client_ids text[] not null default '{}'::text[];

drop trigger if exists touch_updated_at on public.media;
create trigger touch_updated_at
before update on public.media
for each row execute procedure public.touch_updated_at();

create index if not exists calendar_goal_idx on public.calendar_entries(goal_id);
create index if not exists media_goal_idx on public.media(goal_id);
create index if not exists media_user_client_idx on public.media(user_id, client_id);
create index if not exists workout_user_updated_idx on public.workout_sessions(user_id, updated_at desc);

alter table public.profiles replica identity full;
alter table public.goals replica identity full;
alter table public.tasks replica identity full;
alter table public.calendar_entries replica identity full;
alter table public.workout_sessions replica identity full;
alter table public.media replica identity full;
alter table public.user_settings replica identity full;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles',
    'goals',
    'tasks',
    'calendar_entries',
    'workout_sessions',
    'media',
    'user_settings'
  ] loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;
