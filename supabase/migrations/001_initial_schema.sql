-- ============================================================
-- ANGRY SPORTS — Initial Schema
-- All tables created first, then all RLS policies at the end
-- ============================================================

create extension if not exists "pgcrypto";

-- ============================================================
-- TABLES
-- ============================================================

create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  display_name  text not null,
  avatar_url    text,
  created_at    timestamptz not null default now()
);

create table public.leagues (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  commissioner_id       uuid not null references public.profiles(id),
  status                text not null default 'setup'
                          check (status in ('setup','drafting','active','offseason')),
  scoring_type          text not null default 'head_to_head_points'
                          check (scoring_type in ('head_to_head_points','rotisserie')),
  season_year           int not null default extract(year from now())::int,
  max_teams             int not null default 12,
  is_keeper_league      boolean not null default false,
  is_contract_league    boolean not null default false,
  max_keepers_per_team  int not null default 0,
  has_taxi_squad        boolean not null default false,
  taxi_squad_size       int not null default 3,
  playoff_teams         int not null default 4,
  playoff_start_week    int not null default 22,
  playoff_weeks         int not null default 3,
  regular_season_weeks  int not null default 21,
  is_public             boolean not null default false,
  invite_code           text unique default gen_random_uuid()::text,
  created_at            timestamptz not null default now()
);

create table public.league_settings (
  id                    uuid primary key default gen_random_uuid(),
  league_id             uuid not null unique references public.leagues(id) on delete cascade,
  spots_c               int not null default 1,
  spots_1b              int not null default 1,
  spots_2b              int not null default 1,
  spots_3b              int not null default 1,
  spots_ss              int not null default 1,
  spots_of              int not null default 3,
  spots_util            int not null default 1,
  spots_sp              int not null default 2,
  spots_rp              int not null default 2,
  spots_p               int not null default 2,
  spots_bench           int not null default 4,
  spots_il              int not null default 2,
  draft_type            text not null default 'auction'
                          check (draft_type in ('auction','snake','linear')),
  auction_budget        int not null default 260,
  snake_rounds          int not null default 25,
  pick_time_seconds     int not null default 90,
  rookie_draft_rounds   int not null default 5,
  rookie_pick_time_sec  int not null default 120,
  waiver_type           text not null default 'faab'
                          check (waiver_type in ('standard','faab','reverse_standings')),
  faab_budget           int not null default 500,
  waiver_day            text not null default 'wednesday',
  waiver_period_days    int not null default 2,
  trade_deadline_week   int not null default 20,
  trade_review_period   int not null default 2,
  max_contract_years    int not null default 3,
  rookie_contract_years int not null default 2,
  salary_cap            int,
  tiebreaker            text not null default 'total_points'
                          check (tiebreaker in ('total_points','head_to_head','coin_flip'))
);

create table public.scoring_categories (
  id                uuid primary key default gen_random_uuid(),
  league_id         uuid not null references public.leagues(id) on delete cascade,
  stat_key          text not null,
  label             text not null,
  points_per_unit   numeric not null default 1,
  is_batting        boolean not null default false,
  is_pitching       boolean not null default false,
  is_negative       boolean not null default false,
  sort_order        int not null default 0,
  unique (league_id, stat_key)
);

create table public.players (
  id                  uuid primary key default gen_random_uuid(),
  mlb_id              int not null unique,
  full_name           text not null,
  first_name          text not null,
  last_name           text not null,
  primary_position    text not null,
  eligible_positions  text[] not null default '{}',
  mlb_team            text,
  mlb_team_id         int,
  jersey_number       text,
  bats                text check (bats in ('L','R','S')),
  throws              text check (throws in ('L','R')),
  birth_date          date,
  status              text not null default 'active'
                        check (status in ('active','injured','minors','inactive','nl')),
  is_rookie           boolean not null default false,
  pro_debut_year      int,
  photo_url           text,
  updated_at          timestamptz not null default now()
);

create index on public.players(mlb_team_id);
create index on public.players(primary_position);
create index on public.players(status);

create table public.fantasy_teams (
  id                uuid primary key default gen_random_uuid(),
  league_id         uuid not null references public.leagues(id) on delete cascade,
  owner_id          uuid not null references public.profiles(id),
  name              text not null,
  abbreviation      text not null,
  logo_url          text,
  waiver_priority   int not null default 1,
  faab_remaining    int not null default 500,
  wins              int not null default 0,
  losses            int not null default 0,
  ties              int not null default 0,
  points_for        numeric not null default 0,
  points_against    numeric not null default 0,
  created_at        timestamptz not null default now(),
  unique (league_id, owner_id)
);

create table public.rosters (
  id                uuid primary key default gen_random_uuid(),
  team_id           uuid not null references public.fantasy_teams(id) on delete cascade,
  player_id         uuid not null references public.players(id),
  slot_type         text not null
                      check (slot_type in ('C','1B','2B','3B','SS','OF','UTIL',
                                           'SP','RP','P','BENCH','TAXI','IL')),
  acquisition_type  text not null default 'draft'
                      check (acquisition_type in ('draft','waiver','trade','free_agent','commissioner')),
  acquired_at       timestamptz not null default now(),
  unique (team_id, player_id)
);

create table public.contracts (
  id                    uuid primary key default gen_random_uuid(),
  league_id             uuid not null references public.leagues(id) on delete cascade,
  team_id               uuid not null references public.fantasy_teams(id),
  player_id             uuid not null references public.players(id),
  years_total           int not null default 1,
  years_remaining       int not null default 1,
  salary                numeric not null default 1,
  contract_type         text not null default 'standard'
                          check (contract_type in ('standard','rookie','extension','minimum')),
  is_protected          boolean not null default false,
  signed_at             timestamptz not null default now(),
  expires_after_season  int not null,
  voided_at             timestamptz,
  unique (league_id, player_id, expires_after_season)
);

create table public.drafts (
  id                  uuid primary key default gen_random_uuid(),
  league_id           uuid not null references public.leagues(id) on delete cascade,
  phase               text not null default 'free_agency'
                        check (phase in ('free_agency','rookie_draft')),
  draft_type          text not null default 'auction'
                        check (draft_type in ('auction','snake','linear')),
  status              text not null default 'pending'
                        check (status in ('pending','active','paused','completed')),
  current_pick        int not null default 1,
  current_round       int not null default 1,
  current_team_id     uuid references public.fantasy_teams(id),
  pick_time_seconds   int not null default 90,
  started_at          timestamptz,
  completed_at        timestamptz,
  created_at          timestamptz not null default now()
);

create table public.draft_order (
  id          uuid primary key default gen_random_uuid(),
  draft_id    uuid not null references public.drafts(id) on delete cascade,
  team_id     uuid not null references public.fantasy_teams(id),
  pick_number int not null,
  round       int not null default 1,
  unique (draft_id, pick_number, round)
);

create table public.draft_picks (
  id                      uuid primary key default gen_random_uuid(),
  draft_id                uuid not null references public.drafts(id) on delete cascade,
  team_id                 uuid not null references public.fantasy_teams(id),
  player_id               uuid not null references public.players(id),
  pick_number             int not null,
  round                   int not null default 1,
  bid_amount              numeric,
  nominated_by_team_id    uuid references public.fantasy_teams(id),
  picked_at               timestamptz not null default now(),
  unique (draft_id, player_id)
);

create table public.auction_nominations (
  id                        uuid primary key default gen_random_uuid(),
  draft_id                  uuid not null references public.drafts(id) on delete cascade,
  player_id                 uuid not null references public.players(id),
  nominated_by_team_id      uuid not null references public.fantasy_teams(id),
  current_bid               numeric not null default 1,
  current_high_bidder_id    uuid references public.fantasy_teams(id),
  bid_deadline              timestamptz,
  status                    text not null default 'active'
                              check (status in ('active','sold','expired')),
  created_at                timestamptz not null default now()
);

create table public.matchups (
  id              uuid primary key default gen_random_uuid(),
  league_id       uuid not null references public.leagues(id) on delete cascade,
  season_year     int not null,
  week            int not null,
  home_team_id    uuid not null references public.fantasy_teams(id),
  away_team_id    uuid not null references public.fantasy_teams(id),
  home_score      numeric not null default 0,
  away_score      numeric not null default 0,
  status          text not null default 'upcoming'
                    check (status in ('upcoming','active','final')),
  is_playoff      boolean not null default false,
  period_start    date not null,
  period_end      date not null
);

create index on public.matchups(league_id, week);

create table public.team_weekly_scores (
  id                  uuid primary key default gen_random_uuid(),
  matchup_id          uuid not null references public.matchups(id) on delete cascade,
  team_id             uuid not null references public.fantasy_teams(id),
  total_points        numeric not null default 0,
  breakdown           jsonb not null default '{}',
  last_calculated_at  timestamptz not null default now(),
  unique (matchup_id, team_id)
);

create table public.player_game_scores (
  id              uuid primary key default gen_random_uuid(),
  player_id       uuid not null references public.players(id),
  matchup_id      uuid not null references public.matchups(id) on delete cascade,
  team_id         uuid not null references public.fantasy_teams(id),
  game_date       date not null,
  mlb_game_id     int,
  raw_stats       jsonb not null default '{}',
  fantasy_points  numeric not null default 0,
  breakdown       jsonb not null default '{}',
  calculated_at   timestamptz not null default now()
);

create index on public.player_game_scores(player_id, game_date);
create index on public.player_game_scores(matchup_id);

create table public.transactions (
  id                    uuid primary key default gen_random_uuid(),
  league_id             uuid not null references public.leagues(id) on delete cascade,
  type                  text not null
                          check (type in ('add','drop','trade','waiver_claim','commissioner')),
  status                text not null default 'pending'
                          check (status in ('pending','approved','rejected','completed')),
  initiated_by_team_id  uuid not null references public.fantasy_teams(id),
  notes                 text,
  created_at            timestamptz not null default now(),
  processed_at          timestamptz
);

create table public.transaction_items (
  id                uuid primary key default gen_random_uuid(),
  transaction_id    uuid not null references public.transactions(id) on delete cascade,
  player_id         uuid not null references public.players(id),
  from_team_id      uuid references public.fantasy_teams(id),
  to_team_id        uuid references public.fantasy_teams(id),
  faab_bid          numeric
);

create table public.trade_proposals (
  id                uuid primary key default gen_random_uuid(),
  league_id         uuid not null references public.leagues(id) on delete cascade,
  proposing_team_id uuid not null references public.fantasy_teams(id),
  receiving_team_id uuid not null references public.fantasy_teams(id),
  status            text not null default 'pending'
                      check (status in ('pending','accepted','rejected','countered','withdrawn','vetoed')),
  message           text,
  expires_at        timestamptz,
  created_at        timestamptz not null default now(),
  responded_at      timestamptz
);

create table public.trade_items (
  id                  uuid primary key default gen_random_uuid(),
  trade_proposal_id   uuid not null references public.trade_proposals(id) on delete cascade,
  player_id           uuid not null references public.players(id),
  from_team_id        uuid not null references public.fantasy_teams(id),
  to_team_id          uuid not null references public.fantasy_teams(id),
  include_contract    boolean not null default true
);

create table public.waiver_claims (
  id              uuid primary key default gen_random_uuid(),
  league_id       uuid not null references public.leagues(id) on delete cascade,
  team_id         uuid not null references public.fantasy_teams(id),
  player_add_id   uuid not null references public.players(id),
  player_drop_id  uuid references public.players(id),
  bid_amount      numeric not null default 0,
  priority        int,
  status          text not null default 'pending'
                    check (status in ('pending','won','lost','cancelled')),
  process_date    date not null,
  created_at      timestamptz not null default now()
);

create table public.league_invites (
  id            uuid primary key default gen_random_uuid(),
  league_id     uuid not null references public.leagues(id) on delete cascade,
  email         text,
  invite_code   text not null unique default gen_random_uuid()::text,
  used_by       uuid references public.profiles(id),
  used_at       timestamptz,
  expires_at    timestamptz,
  created_at    timestamptz not null default now()
);

create table public.schedule_weeks (
  id            uuid primary key default gen_random_uuid(),
  league_id     uuid not null references public.leagues(id) on delete cascade,
  week          int not null,
  season_year   int not null,
  period_start  date not null,
  period_end    date not null,
  is_playoff    boolean not null default false,
  unique (league_id, week, season_year)
);

create table public.announcements (
  id            uuid primary key default gen_random_uuid(),
  league_id     uuid not null references public.leagues(id) on delete cascade,
  author_id     uuid not null references public.profiles(id),
  title         text not null,
  body          text not null,
  pinned        boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- AUTH TRIGGER (auto-create profile on signup)
-- ============================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY — enable on all tables
-- ============================================================

alter table public.profiles enable row level security;
alter table public.leagues enable row level security;
alter table public.league_settings enable row level security;
alter table public.scoring_categories enable row level security;
alter table public.players enable row level security;
alter table public.fantasy_teams enable row level security;
alter table public.rosters enable row level security;
alter table public.contracts enable row level security;
alter table public.drafts enable row level security;
alter table public.draft_order enable row level security;
alter table public.draft_picks enable row level security;
alter table public.auction_nominations enable row level security;
alter table public.matchups enable row level security;
alter table public.team_weekly_scores enable row level security;
alter table public.player_game_scores enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_items enable row level security;
alter table public.trade_proposals enable row level security;
alter table public.trade_items enable row level security;
alter table public.waiver_claims enable row level security;
alter table public.league_invites enable row level security;
alter table public.schedule_weeks enable row level security;
alter table public.announcements enable row level security;

-- ============================================================
-- RLS POLICIES (all tables created above, safe to reference)
-- ============================================================

-- profiles
create policy "Users can view all profiles" on public.profiles for select using (true);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- players (public read)
create policy "Authenticated users can view players" on public.players for select using (auth.role() = 'authenticated');

-- leagues
create policy "League members can view league" on public.leagues for select
  using (commissioner_id = auth.uid()
      or id in (select league_id from public.fantasy_teams where owner_id = auth.uid()));
create policy "Authenticated users can create leagues" on public.leagues for insert
  with check (auth.role() = 'authenticated');
create policy "Commissioner can update league" on public.leagues for update
  using (commissioner_id = auth.uid());

-- league_settings
create policy "League members can view settings" on public.league_settings for select
  using (league_id in (select id from public.leagues where commissioner_id = auth.uid())
      or league_id in (select league_id from public.fantasy_teams where owner_id = auth.uid()));
create policy "Commissioner can manage settings" on public.league_settings for all
  using (league_id in (select id from public.leagues where commissioner_id = auth.uid()));

-- scoring_categories
create policy "League members can view scoring" on public.scoring_categories for select
  using (league_id in (select id from public.leagues where commissioner_id = auth.uid())
      or league_id in (select league_id from public.fantasy_teams where owner_id = auth.uid()));
create policy "Commissioner can manage scoring" on public.scoring_categories for all
  using (league_id in (select id from public.leagues where commissioner_id = auth.uid()));

-- fantasy_teams
create policy "League members can view teams" on public.fantasy_teams for select
  using (league_id in (select id from public.leagues where commissioner_id = auth.uid())
      or league_id in (select league_id from public.fantasy_teams ft2 where ft2.owner_id = auth.uid()));
create policy "Authenticated users can create teams" on public.fantasy_teams for insert
  with check (auth.role() = 'authenticated');
create policy "Owners can update their team" on public.fantasy_teams for update
  using (owner_id = auth.uid());

-- rosters
create policy "League members can view rosters" on public.rosters for select
  using (team_id in (
    select ft.id from public.fantasy_teams ft
    where ft.league_id in (select league_id from public.fantasy_teams where owner_id = auth.uid())
  ));
create policy "Team owners can manage roster" on public.rosters for all
  using (team_id in (select id from public.fantasy_teams where owner_id = auth.uid()));

-- contracts
create policy "League members can view contracts" on public.contracts for select
  using (league_id in (select id from public.leagues where commissioner_id = auth.uid())
      or league_id in (select league_id from public.fantasy_teams where owner_id = auth.uid()));
create policy "Commissioner can manage contracts" on public.contracts for all
  using (league_id in (select id from public.leagues where commissioner_id = auth.uid()));

-- drafts
create policy "League members can view drafts" on public.drafts for select
  using (league_id in (select id from public.leagues where commissioner_id = auth.uid())
      or league_id in (select league_id from public.fantasy_teams where owner_id = auth.uid()));

-- draft_order
create policy "League members can view draft order" on public.draft_order for select
  using (draft_id in (
    select d.id from public.drafts d
    where d.league_id in (select league_id from public.fantasy_teams where owner_id = auth.uid())
       or d.league_id in (select id from public.leagues where commissioner_id = auth.uid())
  ));

-- draft_picks
create policy "League members can view draft picks" on public.draft_picks for select
  using (draft_id in (
    select d.id from public.drafts d
    where d.league_id in (select league_id from public.fantasy_teams where owner_id = auth.uid())
       or d.league_id in (select id from public.leagues where commissioner_id = auth.uid())
  ));

-- auction_nominations
create policy "League members can view nominations" on public.auction_nominations for select
  using (draft_id in (
    select d.id from public.drafts d
    where d.league_id in (select league_id from public.fantasy_teams where owner_id = auth.uid())
       or d.league_id in (select id from public.leagues where commissioner_id = auth.uid())
  ));

-- matchups
create policy "League members can view matchups" on public.matchups for select
  using (league_id in (select id from public.leagues where commissioner_id = auth.uid())
      or league_id in (select league_id from public.fantasy_teams where owner_id = auth.uid()));

-- team_weekly_scores
create policy "League members can view scores" on public.team_weekly_scores for select
  using (matchup_id in (
    select id from public.matchups
    where league_id in (select league_id from public.fantasy_teams where owner_id = auth.uid())
       or league_id in (select id from public.leagues where commissioner_id = auth.uid())
  ));

-- player_game_scores
create policy "League members can view game scores" on public.player_game_scores for select
  using (matchup_id in (
    select id from public.matchups
    where league_id in (select league_id from public.fantasy_teams where owner_id = auth.uid())
       or league_id in (select id from public.leagues where commissioner_id = auth.uid())
  ));

-- transactions
create policy "League members can view transactions" on public.transactions for select
  using (league_id in (select id from public.leagues where commissioner_id = auth.uid())
      or league_id in (select league_id from public.fantasy_teams where owner_id = auth.uid()));

-- transaction_items
create policy "League members can view transaction items" on public.transaction_items for select
  using (transaction_id in (
    select id from public.transactions
    where league_id in (select league_id from public.fantasy_teams where owner_id = auth.uid())
       or league_id in (select id from public.leagues where commissioner_id = auth.uid())
  ));

-- trade_proposals
create policy "League members can view trades" on public.trade_proposals for select
  using (league_id in (select id from public.leagues where commissioner_id = auth.uid())
      or league_id in (select league_id from public.fantasy_teams where owner_id = auth.uid()));

-- trade_items
create policy "League members can view trade items" on public.trade_items for select
  using (trade_proposal_id in (
    select id from public.trade_proposals
    where league_id in (select league_id from public.fantasy_teams where owner_id = auth.uid())
       or league_id in (select id from public.leagues where commissioner_id = auth.uid())
  ));

-- waiver_claims
create policy "League members can view waivers" on public.waiver_claims for select
  using (league_id in (select id from public.leagues where commissioner_id = auth.uid())
      or league_id in (select league_id from public.fantasy_teams where owner_id = auth.uid()));

-- league_invites
create policy "Commissioner can manage invites" on public.league_invites for all
  using (league_id in (select id from public.leagues where commissioner_id = auth.uid()));
create policy "Anyone can view invite by code" on public.league_invites for select
  using (true);

-- schedule_weeks
create policy "League members can view schedule" on public.schedule_weeks for select
  using (league_id in (select id from public.leagues where commissioner_id = auth.uid())
      or league_id in (select league_id from public.fantasy_teams where owner_id = auth.uid()));

-- announcements
create policy "League members can view announcements" on public.announcements for select
  using (league_id in (select id from public.leagues where commissioner_id = auth.uid())
      or league_id in (select league_id from public.fantasy_teams where owner_id = auth.uid()));
create policy "Commissioner can manage announcements" on public.announcements for all
  using (league_id in (select id from public.leagues where commissioner_id = auth.uid()));
