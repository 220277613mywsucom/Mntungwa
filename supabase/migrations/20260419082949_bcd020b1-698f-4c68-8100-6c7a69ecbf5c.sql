-- Storage buckets
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('post-images', 'post-images', true)
  on conflict (id) do nothing;

-- Avatars policies
create policy "Avatars publicly viewable"
  on storage.objects for select
  using (bucket_id = 'avatars');
create policy "Users upload own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users update own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users delete own avatar"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

-- Post images policies
create policy "Post images publicly viewable"
  on storage.objects for select
  using (bucket_id = 'post-images');
create policy "Users upload own post image"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'post-images' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users delete own post image"
  on storage.objects for delete to authenticated
  using (bucket_id = 'post-images' and auth.uid()::text = (storage.foldername(name))[1]);

-- Notifications
create type public.notif_type as enum ('like', 'comment', 'follow');

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,  -- recipient
  actor_id uuid not null references auth.users(id) on delete cascade, -- who did it
  type public.notif_type not null,
  post_id uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (user_id <> actor_id)
);
create index notifications_user_idx on public.notifications(user_id, created_at desc);
alter table public.notifications enable row level security;

create policy "View own notifications" on public.notifications for select to authenticated
  using (auth.uid() = user_id);
create policy "Mark own notifications read" on public.notifications for update to authenticated
  using (auth.uid() = user_id);
create policy "Delete own notifications" on public.notifications for delete to authenticated
  using (auth.uid() = user_id);

alter publication supabase_realtime add table public.notifications;

-- Trigger: like notifications
create or replace function public.notify_on_like()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select user_id into owner from public.posts where id = new.post_id;
  if owner is not null and owner <> new.user_id then
    insert into public.notifications (user_id, actor_id, type, post_id)
    values (owner, new.user_id, 'like', new.post_id);
  end if;
  return new;
end; $$;
create trigger likes_notify after insert on public.likes
  for each row execute function public.notify_on_like();

-- Trigger: comment notifications
create or replace function public.notify_on_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select user_id into owner from public.posts where id = new.post_id;
  if owner is not null and owner <> new.user_id then
    insert into public.notifications (user_id, actor_id, type, post_id, comment_id)
    values (owner, new.user_id, 'comment', new.post_id, new.id);
  end if;
  return new;
end; $$;
create trigger comments_notify after insert on public.comments
  for each row execute function public.notify_on_comment();

-- Trigger: follow notifications
create or replace function public.notify_on_follow()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, actor_id, type)
  values (new.following_id, new.follower_id, 'follow');
  return new;
end; $$;
create trigger follows_notify after insert on public.follows
  for each row execute function public.notify_on_follow();