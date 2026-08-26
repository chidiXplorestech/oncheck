-- ONTRACK unified account state.
-- Production migration name: unified_user_state.
-- This table is the source of truth for meaningful browser-persisted state that has
-- not yet been promoted to its own normalized Supabase table.

create table if not exists public.user_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  state_key text not null,
  value jsonb not null,
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, state_key)
);

alter table public.user_state enable row level security;

create policy user_state_select_own on public.user_state
for select to authenticated using ((select auth.uid()) = user_id);
create policy user_state_insert_own on public.user_state
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy user_state_update_own on public.user_state
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy user_state_delete_own on public.user_state
for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.touch_user_state()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  if tg_op = 'UPDATE' then new.revision = old.revision + 1; end if;
  return new;
end;
$$;

drop trigger if exists touch_user_state on public.user_state;
create trigger touch_user_state before update on public.user_state
for each row execute procedure public.touch_user_state();

alter table public.user_state replica identity full;
create index if not exists user_state_updated_idx on public.user_state(user_id, updated_at desc);

-- Existing accounts are seeded from prior Sync V2 cloud state.
insert into public.user_state (user_id, state_key, value)
select
  u.id,
  'oncheck-account-v2',
  jsonb_build_object(
    'name', coalesce(p.display_name, u.raw_user_meta_data ->> 'display_name', 'Account'),
    'role', coalesce(s.settings ->> 'role', 'Personal OS'),
    'email', coalesce(u.email, ''),
    'maxDailyPriorities', coalesce((s.settings #>> '{sync_v2,execution,maxDailyPriorities}')::int, 3),
    'lowEnergyMinutes', coalesce((s.settings #>> '{sync_v2,execution,lowEnergyMinutes}')::int, 60),
    'weekStart', coalesce(s.settings #>> '{sync_v2,execution,weekStart}', 'monday')
  )
from auth.users u
left join public.profiles p on p.id = u.id
left join public.user_settings s on s.user_id = u.id
on conflict (user_id, state_key) do nothing;

insert into public.user_state (user_id, state_key, value)
select user_id, 'oncheck-daily-focus-v2', settings #> '{sync_v2,focus}'
from public.user_settings
where settings #> '{sync_v2,focus}' is not null and settings #> '{sync_v2,focus}' <> 'null'::jsonb
on conflict (user_id, state_key) do nothing;

insert into public.user_state (user_id, state_key, value)
select user_id, 'oncheck-weekly-review-v2', settings #> '{sync_v2,review}'
from public.user_settings
where settings #> '{sync_v2,review}' is not null and settings #> '{sync_v2,review}' <> 'null'::jsonb
on conflict (user_id, state_key) do nothing;

insert into public.user_state (user_id, state_key, value)
select user_id, 'oncheck-training-space-v1', settings #> '{sync_v2,workout}'
from public.user_settings
where settings #> '{sync_v2,workout}' is not null and settings #> '{sync_v2,workout}' <> 'null'::jsonb
on conflict (user_id, state_key) do nothing;

insert into public.user_state (user_id, state_key, value)
select user_id, 'oncheck-cover-map-v2', coalesce(settings #> '{sync_v2,coverMap}', '{}'::jsonb)
from public.user_settings where settings ? 'sync_v2'
on conflict (user_id, state_key) do nothing;

insert into public.user_state (user_id, state_key, value)
select
  u.id,
  'oncheck-state-v1',
  jsonb_build_object(
    'goals', coalesce((
      select jsonb_agg(
        jsonb_strip_nulls(jsonb_build_object(
          'id', coalesce(g.client_id, g.id::text),
          'title', g.title,
          'category', g.category,
          'status', g.status,
          'priority', g.priority,
          'cadence', g.cadence,
          'targetDate', coalesce(g.target_date::text, ''),
          'notes', g.notes,
          'cover', case when g.cover_path like 'http%' then g.cover_path else null end,
          'tasks', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', coalesce(t.client_id, t.id::text),
              'title', t.title,
              'done', t.done
            ) order by t.position, t.created_at)
            from public.tasks t where t.goal_id = g.id and t.user_id = u.id
          ), '[]'::jsonb)
        )) order by g.created_at
      ) from public.goals g where g.user_id = u.id
    ), '[]'::jsonb),
    'blocks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', coalesce(c.client_id, c.id::text),
        'goalId', coalesce(g2.client_id, g2.id::text, ''),
        'day', coalesce(c.day_index, 0),
        'start', coalesce(c.start_hour, 0),
        'duration', coalesce(c.duration_hours, 1),
        'title', c.title,
        'done', c.done
      ) order by c.created_at)
      from public.calendar_entries c
      left join public.goals g2 on g2.id = c.goal_id
      where c.user_id = u.id
    ), '[]'::jsonb),
    'media', '[]'::jsonb
  )
from auth.users u
where exists (select 1 from public.goals g where g.user_id = u.id)
   or exists (select 1 from public.calendar_entries c where c.user_id = u.id)
on conflict (user_id, state_key) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_state'
  ) then
    alter publication supabase_realtime add table public.user_state;
  end if;
end $$;
