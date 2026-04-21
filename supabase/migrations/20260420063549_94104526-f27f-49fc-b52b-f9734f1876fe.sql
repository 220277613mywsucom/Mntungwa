-- =========================================================
-- BOOKMARKS
-- =========================================================
create table public.bookmarks (
  user_id uuid not null,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
alter table public.bookmarks enable row level security;

create policy "Bookmarks: view own" on public.bookmarks
  for select to authenticated using (auth.uid() = user_id);
create policy "Bookmarks: add own" on public.bookmarks
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Bookmarks: remove own" on public.bookmarks
  for delete to authenticated using (auth.uid() = user_id);

create index bookmarks_user_idx on public.bookmarks(user_id, created_at desc);

-- =========================================================
-- HASHTAGS
-- =========================================================
create table public.post_hashtags (
  post_id uuid not null references public.posts(id) on delete cascade,
  tag text not null,
  created_at timestamptz not null default now(),
  primary key (post_id, tag)
);
alter table public.post_hashtags enable row level security;

create policy "Hashtags: viewable" on public.post_hashtags
  for select to authenticated using (true);

create index post_hashtags_tag_idx on public.post_hashtags(tag, created_at desc);

create or replace function public.extract_post_hashtags()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  m text;
begin
  delete from public.post_hashtags where post_id = new.id;
  if new.content is not null then
    for m in
      select distinct lower(substring(match[1] from 2))
      from regexp_matches(new.content, '(#[A-Za-z0-9_]{2,30})', 'g') as match
    loop
      insert into public.post_hashtags(post_id, tag)
      values (new.id, m)
      on conflict do nothing;
    end loop;
  end if;
  return new;
end;
$$;

create trigger trg_posts_extract_hashtags
after insert or update of content on public.posts
for each row execute function public.extract_post_hashtags();

-- =========================================================
-- EVENTS
-- =========================================================
create table public.events (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null,
  title text not null,
  description text,
  location text,
  start_at timestamptz not null,
  end_at timestamptz,
  cover_url text,
  created_at timestamptz not null default now()
);
alter table public.events enable row level security;

create policy "Events: viewable" on public.events
  for select to authenticated using (true);
create policy "Events: create own" on public.events
  for insert to authenticated with check (auth.uid() = created_by);
create policy "Events: update own" on public.events
  for update to authenticated using (auth.uid() = created_by);
create policy "Events: delete own" on public.events
  for delete to authenticated using (auth.uid() = created_by);

create index events_start_idx on public.events(start_at);

-- Validation: end_at must be after start_at (trigger, not check, so it stays mutable)
create or replace function public.validate_event_times()
returns trigger
language plpgsql
as $$
begin
  if new.end_at is not null and new.end_at <= new.start_at then
    raise exception 'Event end time must be after start time';
  end if;
  return new;
end;
$$;
create trigger trg_events_validate_times
before insert or update on public.events
for each row execute function public.validate_event_times();

create type public.rsvp_status as enum ('going', 'maybe', 'not_going');

create table public.event_rsvps (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null,
  status public.rsvp_status not null default 'going',
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
alter table public.event_rsvps enable row level security;

create policy "RSVPs: viewable" on public.event_rsvps
  for select to authenticated using (true);
create policy "RSVPs: create own" on public.event_rsvps
  for insert to authenticated with check (auth.uid() = user_id);
create policy "RSVPs: update own" on public.event_rsvps
  for update to authenticated using (auth.uid() = user_id);
create policy "RSVPs: delete own" on public.event_rsvps
  for delete to authenticated using (auth.uid() = user_id);

-- =========================================================
-- REPORTS
-- =========================================================
create type public.report_target as enum ('post', 'message', 'profile');

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null,
  target_type public.report_target not null,
  target_id uuid not null,
  reason text not null,
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;

create policy "Reports: view own" on public.reports
  for select to authenticated using (auth.uid() = reporter_id);
create policy "Reports: create" on public.reports
  for insert to authenticated with check (auth.uid() = reporter_id);

-- =========================================================
-- BLOCKS
-- =========================================================
create table public.blocks (
  blocker_id uuid not null,
  blocked_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.blocks enable row level security;

create policy "Blocks: view own" on public.blocks
  for select to authenticated using (auth.uid() = blocker_id);
create policy "Blocks: create own" on public.blocks
  for insert to authenticated with check (auth.uid() = blocker_id);
create policy "Blocks: remove own" on public.blocks
  for delete to authenticated using (auth.uid() = blocker_id);

-- Realtime
alter publication supabase_realtime add table public.bookmarks;
alter publication supabase_realtime add table public.events;
alter publication supabase_realtime add table public.event_rsvps;
alter publication supabase_realtime add table public.blocks;