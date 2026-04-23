-- Watchlist: users can watch players across any league context
create table if not exists watchlist (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  player_id   uuid not null references players(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique(user_id, player_id)
);

-- RLS: users can only see and manage their own watchlist
alter table watchlist enable row level security;

create policy "Users can read own watchlist"
  on watchlist for select
  using (auth.uid() = user_id);

create policy "Users can add to own watchlist"
  on watchlist for insert
  with check (auth.uid() = user_id);

create policy "Users can remove from own watchlist"
  on watchlist for delete
  using (auth.uid() = user_id);
