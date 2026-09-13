-- StreamFlix Supabase Schema (Milestone 3)
-- Paste into Supabase SQL editor. Assumes auth.users already exists (Supabase Auth).

-- Public profile + auto-generated User ID
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  user_code text unique not null default (
    'SF-' || upper(substr(md5(random()::text), 1, 4)) || '-' || upper(substr(md5(random()::text), 1, 4))
  ),
  display_name text,
  avatar_url text,
  is_premium boolean default false,
  language text default 'en',
  theme text default 'dark',
  created_at timestamptz default now()
);

-- Titles (movies + series)
create table public.titles (
  id uuid primary key default gen_random_uuid(),
  type text check (type in ('movie','series')) not null,
  name text not null,
  synopsis text,
  poster_url text,
  release_year int,
  genres text[],
  rating_avg numeric(3,1) default 0,
  is_premium boolean default false,
  created_at timestamptz default now()
);

create table public.episodes (
  id uuid primary key default gen_random_uuid(),
  title_id uuid references public.titles(id) on delete cascade,
  season int not null,
  episode_number int not null,
  name text,
  duration_seconds int,
  stream_urls jsonb, -- {"server1": "...", "server2": "..."}
  unique(title_id, season, episode_number)
);

-- Ratings
create table public.ratings (
  user_id uuid references public.profiles(id) on delete cascade,
  title_id uuid references public.titles(id) on delete cascade,
  score int check (score between 1 and 5),
  created_at timestamptz default now(),
  primary key (user_id, title_id)
);

-- Watchlist / My List
create table public.watchlist (
  user_id uuid references public.profiles(id) on delete cascade,
  title_id uuid references public.titles(id) on delete cascade,
  added_at timestamptz default now(),
  primary key (user_id, title_id)
);

-- Continue Watching / history
create table public.watch_history (
  user_id uuid references public.profiles(id) on delete cascade,
  episode_id uuid references public.episodes(id) on delete cascade,
  progress_seconds int default 0,
  completed boolean default false,
  updated_at timestamptz default now(),
  primary key (user_id, episode_id)
);

-- Friends (bidirectional via status)
create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references public.profiles(id) on delete cascade,
  addressee_id uuid references public.profiles(id) on delete cascade,
  status text check (status in ('pending','accepted','blocked')) default 'pending',
  created_at timestamptz default now(),
  unique(requester_id, addressee_id)
);

-- Chat messages
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references public.profiles(id) on delete cascade,
  receiver_id uuid references public.profiles(id) on delete cascade,
  kind text check (kind in ('text','image','voice','title_share')) default 'text',
  content text,            -- text body, or storage path for image/voice
  shared_title_id uuid references public.titles(id),
  created_at timestamptz default now()
);

-- Watch Party sessions
create table public.watch_parties (
  id uuid primary key default gen_random_uuid(),
  host_id uuid references public.profiles(id) on delete cascade,
  title_id uuid references public.titles(id),
  episode_id uuid references public.episodes(id),
  status text check (status in ('pending','live','ended')) default 'pending',
  playback_position int default 0,
  created_at timestamptz default now()
);

create table public.watch_party_members (
  party_id uuid references public.watch_parties(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (party_id, user_id)
);

-- Row Level Security (enable + basic policies — extend per your needs)
alter table public.profiles enable row level security;
alter table public.watchlist enable row level security;
alter table public.watch_history enable row level security;
alter table public.ratings enable row level security;
alter table public.messages enable row level security;
alter table public.friendships enable row level security;

create policy "own profile" on public.profiles for select using (true);
create policy "own watchlist" on public.watchlist for all using (auth.uid() = user_id);
create policy "own history" on public.watch_history for all using (auth.uid() = user_id);
create policy "own ratings" on public.ratings for all using (auth.uid() = user_id);
create policy "own messages" on public.messages for all using (auth.uid() = sender_id or auth.uid() = receiver_id);
create policy "own friendships" on public.friendships for all using (auth.uid() = requester_id or auth.uid() = addressee_id);
