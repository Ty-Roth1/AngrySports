-- ============================================================
-- Migration 005: Trade System (players, draft picks, cash)
-- ============================================================

-- Add cash trade limit to league_settings
ALTER TABLE public.league_settings
  ADD COLUMN IF NOT EXISTS cash_trade_limit int not null default 30;

-- ============================================================
-- Draft Picks
-- Drop and recreate to guarantee the correct schema.
-- Safe to do because no real data exists yet.
-- ============================================================
DROP TABLE IF EXISTS public.draft_picks CASCADE;

CREATE TABLE public.draft_picks (
  id                uuid primary key default gen_random_uuid(),
  league_id         uuid not null references public.leagues(id) on delete cascade,
  season_year       int not null,
  round             int not null,
  original_team_id  uuid not null references public.fantasy_teams(id),
  current_team_id   uuid not null references public.fantasy_teams(id),
  used              boolean not null default false,
  created_at        timestamptz not null default now(),
  UNIQUE (league_id, season_year, round, original_team_id)
);

-- ============================================================
-- Trades
-- ============================================================
DROP TABLE IF EXISTS public.trade_items CASCADE;
DROP TABLE IF EXISTS public.trades CASCADE;

CREATE TABLE public.trades (
  id                  uuid primary key default gen_random_uuid(),
  league_id           uuid not null references public.leagues(id) on delete cascade,
  proposing_team_id   uuid not null references public.fantasy_teams(id),
  receiving_team_id   uuid not null references public.fantasy_teams(id),
  status              text not null default 'pending'
    CHECK (status IN ('pending','accepted','rejected','countered','cancelled','completed','vetoed')),
  notes               text,
  counter_of          uuid references public.trades(id),
  proposed_at         timestamptz not null default now(),
  responded_at        timestamptz,
  executed_at         timestamptz
);

CREATE TABLE public.trade_items (
  id              uuid primary key default gen_random_uuid(),
  trade_id        uuid not null references public.trades(id) on delete cascade,
  item_type       text not null CHECK (item_type IN ('player','draft_pick','cash')),
  player_id       uuid references public.players(id),
  draft_pick_id   uuid references public.draft_picks(id),
  cash_amount     numeric(8,2) CHECK (cash_amount IS NULL OR cash_amount >= 0),
  from_team_id    uuid not null references public.fantasy_teams(id),
  to_team_id      uuid not null references public.fantasy_teams(id)
);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.draft_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_items ENABLE ROW LEVEL SECURITY;

-- Draft picks: any league member can view all picks
CREATE POLICY "League members can view draft picks"
  ON public.draft_picks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.fantasy_teams
      WHERE fantasy_teams.league_id = draft_picks.league_id
        AND fantasy_teams.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.leagues
      WHERE leagues.id = draft_picks.league_id
        AND (leagues.commissioner_id = auth.uid() OR leagues.co_commissioner_id = auth.uid())
    )
  );

-- Trades: any league member can see all trades (for transparency)
CREATE POLICY "League members can view trades"
  ON public.trades FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.fantasy_teams
      WHERE fantasy_teams.league_id = trades.league_id
        AND fantasy_teams.owner_id = auth.uid()
    )
  );

CREATE POLICY "League members can propose trades"
  ON public.trades FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.fantasy_teams
      WHERE fantasy_teams.id = trades.proposing_team_id
        AND fantasy_teams.owner_id = auth.uid()
    )
  );

CREATE POLICY "Trade participants can update trades"
  ON public.trades FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.fantasy_teams ft
      WHERE ft.league_id = trades.league_id
        AND ft.owner_id = auth.uid()
        AND (ft.id = trades.proposing_team_id OR ft.id = trades.receiving_team_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.leagues l
      WHERE l.id = trades.league_id
        AND (l.commissioner_id = auth.uid() OR l.co_commissioner_id = auth.uid())
    )
  );

-- Trade items: visible to any league member
CREATE POLICY "League members can view trade items"
  ON public.trade_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trades t
      JOIN public.fantasy_teams ft ON ft.league_id = t.league_id
      WHERE t.id = trade_items.trade_id
        AND ft.owner_id = auth.uid()
    )
  );

CREATE POLICY "Trade proposers can insert trade items"
  ON public.trade_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trades t
      JOIN public.fantasy_teams ft ON ft.id = t.proposing_team_id
      WHERE t.id = trade_items.trade_id
        AND ft.owner_id = auth.uid()
    )
  );
