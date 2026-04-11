-- Team logos
alter table fantasy_teams add column if not exists logo_url text;

-- Season history per team
create table if not exists team_season_records (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid references fantasy_teams(id) on delete cascade not null,
  season_year   int not null,
  is_champion   boolean not null default false,
  finish_place  int,              -- 1 = champion, 2 = runner-up, etc.
  awards        text[] not null default '{}',
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique(team_id, season_year)
);

alter table team_season_records enable row level security;

-- Anyone can read season records
create policy "team_season_records_select" on team_season_records
  for select using (true);

-- Only the team owner can insert/update/delete
create policy "team_season_records_owner_write" on team_season_records
  for all using (
    exists (
      select 1 from fantasy_teams
      where id = team_season_records.team_id
        and owner_id = auth.uid()
    )
  );
