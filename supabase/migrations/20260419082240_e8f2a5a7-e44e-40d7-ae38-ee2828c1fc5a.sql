-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null,
  bio text,
  avatar_url text,
  faculty text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "Profiles viewable" on public.profiles for select to authenticated using (true);
create policy "Update own profile" on public.profiles for update to authenticated using (auth.uid() = id);
create policy "Insert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare base_username text; final_username text; counter int := 0;
begin
  base_username := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9_]', '', 'g'));
  if base_username = '' then base_username := 'student'; end if;
  final_username := base_username;
  while exists (select 1 from public.profiles where username = final_username) loop
    counter := counter + 1;
    final_username := base_username || counter::text;
  end loop;
  insert into public.profiles (id, username, display_name)
  values (new.id, final_username, coalesce(new.raw_user_meta_data->>'display_name', final_username));
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Groups
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  cover_gradient text not null default 'from-fuchsia-500 to-orange-400',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.groups enable row level security;
create policy "Groups viewable" on public.groups for select to authenticated using (true);
create policy "Create groups" on public.groups for insert to authenticated with check (auth.uid() = created_by);

create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
alter table public.group_members enable row level security;
create policy "Memberships viewable" on public.group_members for select to authenticated using (true);
create policy "Join group" on public.group_members for insert to authenticated with check (auth.uid() = user_id);
create policy "Leave group" on public.group_members for delete to authenticated using (auth.uid() = user_id);

-- Posts
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  image_url text,
  created_at timestamptz not null default now()
);
create index posts_user_id_idx on public.posts(user_id);
create index posts_group_id_idx on public.posts(group_id);
create index posts_created_at_idx on public.posts(created_at desc);
alter table public.posts enable row level security;
create policy "Posts viewable" on public.posts for select to authenticated using (true);
create policy "Create own posts" on public.posts for insert to authenticated with check (auth.uid() = user_id);
create policy "Update own posts" on public.posts for update to authenticated using (auth.uid() = user_id);
create policy "Delete own posts" on public.posts for delete to authenticated using (auth.uid() = user_id);

-- Likes
create table public.likes (
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
alter table public.likes enable row level security;
create policy "Likes viewable" on public.likes for select to authenticated using (true);
create policy "Like" on public.likes for insert to authenticated with check (auth.uid() = user_id);
create policy "Unlike" on public.likes for delete to authenticated using (auth.uid() = user_id);

-- Comments
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);
create index comments_post_id_idx on public.comments(post_id);
alter table public.comments enable row level security;
create policy "Comments viewable" on public.comments for select to authenticated using (true);
create policy "Comment" on public.comments for insert to authenticated with check (auth.uid() = user_id);
create policy "Delete own comments" on public.comments for delete to authenticated using (auth.uid() = user_id);

-- Follows
create table public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
alter table public.follows enable row level security;
create policy "Follows viewable" on public.follows for select to authenticated using (true);
create policy "Follow" on public.follows for insert to authenticated with check (auth.uid() = follower_id);
create policy "Unfollow" on public.follows for delete to authenticated using (auth.uid() = follower_id);

-- Messages
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);
create index messages_recipient_idx on public.messages(recipient_id, created_at desc);
create index messages_sender_idx on public.messages(sender_id, created_at desc);
alter table public.messages enable row level security;
create policy "View own messages" on public.messages for select to authenticated
  using (auth.uid() = sender_id or auth.uid() = recipient_id);
create policy "Send message" on public.messages for insert to authenticated with check (auth.uid() = sender_id);
create policy "Mark read" on public.messages for update to authenticated using (auth.uid() = recipient_id);

-- Realtime
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.posts;
alter publication supabase_realtime add table public.likes;
alter publication supabase_realtime add table public.comments;

-- Seed groups
insert into public.groups (slug, name, description, cover_gradient) values
  ('cs-uwc', 'Computer Science', 'CS students sharing notes, memes & projects', 'from-fuchsia-500 to-violet-600'),
  ('law-uwc', 'Law Faculty', 'Discuss cases, study groups, moots', 'from-amber-400 to-rose-500'),
  ('sport-uwc', 'Sports & Fitness', 'Gym buddies, teams, intramurals', 'from-emerald-400 to-cyan-500'),
  ('events-uwc', 'Campus Events', 'Whats happening on campus this week', 'from-pink-500 to-orange-400'),
  ('marketplace', 'Marketplace', 'Buy, sell, swap textbooks & more', 'from-indigo-500 to-fuchsia-500');