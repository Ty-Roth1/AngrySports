-- Track dead money for cut players with AAV >= $5M
-- Dead money = half the annual salary, owed for each remaining contract year

create table public.dead_money (
  id                      uuid primary key default gen_random_uuid(),
  league_id               uuid not null references public.leagues(id) on delete cascade,
  team_id                 uuid not null references public.fantasy_teams(id),
  player_id               uuid references public.players(id) on delete set null,
  player_name             text not null,
  original_salary         numeric not null,
  dead_salary_per_year    numeric not null,
  years_remaining_at_cut  int not null,
  season_year_cut         int not null,
  expires_after_season    int not null,
  cut_at                  timestamptz not null default now()
);

alter table public.dead_money enable row level security;

-- Anyone in the league can view dead money
create policy "League members can view dead money" on public.dead_money for select
  using (
    exists (
      select 1 from public.fantasy_teams ft
      where ft.league_id = dead_money.league_id
        and ft.owner_id = auth.uid()
    )
  );

-- Team owner or commissioner can insert dead money
create policy "Team owner can insert dead money" on public.dead_money for insert
  with check (
    exists (
      select 1 from public.fantasy_teams ft
      where ft.id = dead_money.team_id
        and ft.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.leagues l
      where l.id = dead_money.league_id
        and (l.commissioner_id = auth.uid() or l.co_commissioner_id = auth.uid())
    )
  );
